import express, { Router, type Request, type Response } from "express";
import { verifyWebhookSignature, isPaystackConfigured } from "../payments/paystackClient";
import { getServiceRoleClient } from "../supabaseClients";
import { runPaidWorkflow } from "./invoices";
import { invalidate } from "../redis";
import { createNotification } from "../notifications/notify";

export const paymentsWebhookRouter = Router();

// Paystack sends this with no user session at all, so it cannot go through
// requireAuth - the raw HMAC signature below is the ONLY thing that
// authenticates a request as genuinely coming from Paystack. This router is
// mounted in server.ts BEFORE the global express.json() middleware because
// signature verification requires the exact raw request bytes; parsing JSON
// first would make that impossible to recompute correctly.
paymentsWebhookRouter.post("/", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  if (!isPaystackConfigured()) {
    // No secret key configured means we can't verify anything - refuse
    // rather than trust an unverifiable payload.
    res.status(503).end();
    return;
  }

  const rawBody: Buffer = req.body;
  const signature = req.header("x-paystack-signature");

  if (!Buffer.isBuffer(rawBody) || !verifyWebhookSignature(rawBody, signature)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  // Acknowledge immediately-relevant events only; anything else (e.g.
  // subscription events we don't use) is a silent 200 no-op so Paystack
  // doesn't keep retrying a webhook we were never going to act on.
  const event = payload?.event;
  const data = payload?.data;
  const reference: string | undefined = data?.reference;

  if (!reference || (event !== "charge.success" && event !== "charge.failed")) {
    res.status(200).json({ received: true });
    return;
  }

  const supabase = getServiceRoleClient();

  const { data: transaction, error: fetchError } = await supabase
    .from("payment_transactions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (fetchError) {
    console.error("[paystack webhook] failed to load transaction:", fetchError.message);
    res.status(500).json({ error: "Failed to process webhook" });
    return;
  }
  if (!transaction) {
    // Reference we don't recognize - acknowledge so Paystack stops retrying,
    // but there is nothing for us to update.
    res.status(200).json({ received: true });
    return;
  }
  if (transaction.status === "success") {
    // Already processed (Paystack can send the same event more than once) -
    // acknowledge without re-running the paid workflow a second time.
    res.status(200).json({ received: true });
    return;
  }

  const nextStatus = event === "charge.success" ? "success" : "failed";

  const { data: updatedTransaction, error: updateError } = await supabase
    .from("payment_transactions")
    .update({
      status: nextStatus,
      channel: data?.channel ?? null,
      gateway_response: data?.gateway_response ?? null,
      paystack_transaction_id: data?.id ? String(data.id) : null,
      paid_at: nextStatus === "success" ? new Date().toISOString() : null,
      metadata: payload,
    })
    .eq("id", transaction.id)
    .select("*")
    .single();

  if (updateError) {
    console.error("[paystack webhook] failed to update transaction:", updateError.message);
    res.status(500).json({ error: "Failed to process webhook" });
    return;
  }

  await invalidate(`cache:payments:${transaction.user_id}`);

  if (nextStatus === "success") {
    // No authenticated request here to read an email off of - look up the
    // business owner's address the same way the account itself was
    // created with (public.profiles), via the service-role client.
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", transaction.user_id).maybeSingle();
    const recipientEmail = profile?.email;

    if (recipientEmail) {
      await createNotification({
        userId: transaction.user_id,
        businessId: transaction.business_id,
        type: "payment_received",
        referenceId: transaction.id,
        title: "Payment received",
        message: `A payment of ${transaction.currency} ${Number(transaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} was just confirmed via Paystack (reference ${transaction.reference}).`,
        recipientEmail,
      });
    }

    if (updatedTransaction.invoice_id) {
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", updatedTransaction.invoice_id)
        .maybeSingle();

      if (invoiceError) {
        console.error("[paystack webhook] failed to load invoice for paid workflow:", invoiceError.message);
      } else if (invoice && invoice.status !== "Paid") {
        const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id);

        const { data: paidInvoice, error: markPaidError } = await supabase
          .from("invoices")
          .update({ status: "Paid", partial_paid_amount: 0 })
          .eq("id", invoice.id)
          .select("*")
          .single();

        if (markPaidError) {
          console.error("[paystack webhook] failed to mark invoice paid:", markPaidError.message);
        } else {
          await runPaidWorkflow(
            supabase,
            invoice.user_id,
            paidInvoice,
            (items ?? []).map((item: any) => ({
              description: item.description,
              quantity: Number(item.quantity),
              rate: Number(item.rate),
            })),
            recipientEmail
          );
          await invalidate(`cache:invoices:${invoice.user_id}`);
        }
      }
    }
  }

  res.status(200).json({ received: true });
});
