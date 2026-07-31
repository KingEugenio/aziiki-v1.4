import type { Request, Response } from "express";
import { Router } from "express";
import crypto from "crypto";
import { paystackInitializeSchema } from "../validation/payments";
import { isPaystackConfigured, initializeTransaction } from "../payments/paystackClient";
import { toMinorUnits } from "../../lib/money";
import { paystackInitializeLimiter } from "../rateLimiters";

export const paymentsRouter = Router();

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    invoiceId: row.invoice_id ?? undefined,
    customerId: row.customer_id ?? undefined,
    reference: row.reference,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    channel: row.channel ?? undefined,
    paidAt: row.paid_at ?? undefined,
    createdAt: row.created_at,
  };
}

// Starts a Paystack checkout for an invoice (or a standalone payment
// request) and records a "pending" row so the webhook has something to
// update once Paystack confirms the payment. The actual success/failure
// state is only ever written by the webhook (see paymentsWebhook.ts) -
// this route never marks a transaction paid itself, since a client
// redirect completing is not proof a payment actually succeeded.
paymentsRouter.post("/paystack/initialize", paystackInitializeLimiter, async (req: Request, res: Response) => {
  if (!isPaystackConfigured()) {
    res.status(503).json({ error: "Card/Mobile Money payments are not configured on this server (PAYSTACK_SECRET_KEY is not set)." });
    return;
  }

  const parsed = paystackInitializeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  let payerEmail = input.email;
  let resolvedCustomerId = input.customerId ?? null;

  if (input.invoiceId) {
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, business_id, customer_id")
      .eq("id", input.invoiceId)
      .maybeSingle();

    if (invoiceError) {
      res.status(400).json({ error: invoiceError.message });
      return;
    }
    if (!invoice || invoice.business_id !== input.businessId) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }
    resolvedCustomerId = resolvedCustomerId ?? invoice.customer_id ?? null;

    if (!payerEmail && invoice.customer_id) {
      const { data: customer } = await supabase.from("customers").select("email").eq("id", invoice.customer_id).maybeSingle();
      payerEmail = customer?.email ?? undefined;
    }
  }

  if (!payerEmail) {
    res.status(400).json({ error: "An email address is required to start a payment (either directly, or via a customer on file)." });
    return;
  }

  const reference = `aziiki_${crypto.randomBytes(12).toString("hex")}`;

  const { data: transaction, error: insertError } = await supabase
    .from("payment_transactions")
    .insert({
      user_id: userId,
      business_id: input.businessId,
      invoice_id: input.invoiceId ?? null,
      customer_id: resolvedCustomerId,
      reference,
      amount: input.amount,
      currency: input.currency,
      status: "pending",
    })
    .select("*")
    .single();

  if (insertError) {
    res.status(400).json({ error: insertError.message });
    return;
  }

  try {
    const checkout = await initializeTransaction({
      email: payerEmail,
      amountMinorUnits: toMinorUnits(input.amount),
      currency: input.currency,
      reference,
      metadata: { businessId: input.businessId, invoiceId: input.invoiceId ?? null },
    });

    res.status(201).json({
      data: fromRow(transaction),
      authorizationUrl: checkout.authorizationUrl,
    });
  } catch (err: any) {
    // Paystack rejected the request outright (bad key, invalid params) -
    // the pending row is harmless to leave behind (it's just never paid),
    // but let the caller know the checkout could not actually be started.
    res.status(502).json({ error: `Failed to start payment: ${err.message}` });
  }
});

paymentsRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;

  let query = supabase.from("payment_transactions").select("*").order("created_at", { ascending: false }).limit(200);
  if (businessId) query = query.eq("business_id", businessId);

  const { data, error } = await query;
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.json({ data: (data ?? []).map(fromRow) });
});
