import type { Request, Response } from "express";
import { Router } from "express";
import { receiptSchema, receiptUpdateSchema } from "../validation/billing";
import { cached, invalidate } from "../redis";
import { isEmailConfigured, sendTransactionalEmail } from "../email/resendClient";
import { renderReceiptEmailHtml } from "../email/documentTemplates";
import { resolveBusinessCurrency } from "./crudFactory";

const LIST_CACHE_TTL_SECONDS = 45;

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id ?? undefined,
    customClientName: row.custom_client_name ?? undefined,
    invoiceId: row.invoice_id ?? undefined,
    receiptNumber: row.receipt_number,
    date: row.date,
    description: row.description ?? "",
    amountPaid: Number(row.amount_paid),
    paymentMethod: row.payment_method,
    currency: row.currency,
    exchangeRateToBusinessCurrency: Number(row.exchange_rate_to_business_currency),
  };
}

export const receiptsRouter = Router();

receiptsRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const cacheKey = `cache:receipts:${userId}`;

  const allRows = await cached(cacheKey, LIST_CACHE_TTL_SECONDS, async () => {
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw error;
    return data ?? [];
  });

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  const rows = businessId ? allRows.filter((r: any) => r.business_id === businessId) : allRows;
  res.json({ data: rows.map(fromRow) });
});

// Creating a receipt also logs a matching income transaction, exactly like
// the original app's handleAddReceipt did client-side - just done atomically
// on the server now instead of via a debounced full-state re-save.
receiptsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = receiptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  let receiptNumber = input.receiptNumber;
  if (!receiptNumber) {
    const { data: reserved, error: numberError } = await supabase.rpc("next_document_number", {
      p_business_id: input.businessId,
      p_document_type: "receipt",
      p_default_prefix: "REC",
    });
    if (numberError) {
      res.status(400).json({ error: numberError.message });
      return;
    }
    receiptNumber = reserved as string;
  }

  const currency = input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId));

  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: userId,
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      custom_client_name: input.customClientName ?? null,
      invoice_id: input.invoiceId ?? null,
      receipt_number: receiptNumber,
      date: input.date,
      description: input.description,
      amount_paid: input.amountPaid,
      payment_method: input.paymentMethod,
      currency,
      exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
    })
    .select("*")
    .single();

  if (receiptError) {
    res.status(400).json({ error: receiptError.message });
    return;
  }

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: userId,
    business_id: input.businessId,
    customer_id: input.customerId ?? null,
    date: input.date,
    type: "income",
    category: "Client Project",
    amount: input.amountPaid,
    description: input.description,
    payment_method: input.paymentMethod,
    currency,
    exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
  });

  if (txError) {
    console.error("[receipts] failed to log companion transaction:", txError.message);
  }

  await invalidate(`cache:receipts:${userId}`, `cache:transactions:${userId}`);
  res.status(201).json({ data: fromRow(receipt) });
});

receiptsRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = receiptUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;
  const row: Record<string, unknown> = {};
  if (input.customerId !== undefined) row.customer_id = input.customerId ?? null;
  if (input.customClientName !== undefined) row.custom_client_name = input.customClientName ?? null;
  if (input.invoiceId !== undefined) row.invoice_id = input.invoiceId ?? null;
  if (input.receiptNumber !== undefined) row.receipt_number = input.receiptNumber;
  if (input.date !== undefined) row.date = input.date;
  if (input.description !== undefined) row.description = input.description;
  if (input.amountPaid !== undefined) row.amount_paid = input.amountPaid;
  if (input.paymentMethod !== undefined) row.payment_method = input.paymentMethod;
  if (input.currency !== undefined) row.currency = input.currency;
  if (input.exchangeRateToBusinessCurrency !== undefined) row.exchange_rate_to_business_currency = input.exchangeRateToBusinessCurrency;

  if (Object.keys(row).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  const { data, error } = await supabase
    .from("receipts")
    .update(row)
    .eq("id", req.params.id)
    .select("*")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await invalidate(`cache:receipts:${userId}`);
  res.json({ data: fromRow(data) });
});

receiptsRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("receipts")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await invalidate(`cache:receipts:${userId}`);
  res.status(204).send();
});

receiptsRouter.post("/:id/send-email", async (req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    res.status(503).json({ error: "Email sending is not configured on this server (RESEND_API_KEY is not set)." });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (receiptError) {
    res.status(400).json({ error: receiptError.message });
    return;
  }
  if (!receipt) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [{ data: business }, { data: customer }] = await Promise.all([
    supabase.from("businesses").select("name").eq("id", receipt.business_id).single(),
    receipt.customer_id
      ? supabase.from("customers").select("name, email").eq("id", receipt.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const recipientEmail = customer?.email;
  if (!recipientEmail) {
    res.status(400).json({ error: "This customer has no email address on file." });
    return;
  }

  const html = renderReceiptEmailHtml({
    business: { name: business?.name ?? "Your Business" },
    currency: receipt.currency,
    receiptNumber: receipt.receipt_number,
    date: receipt.date,
    customerName: customer?.name ?? receipt.custom_client_name ?? "Valued Customer",
    description: receipt.description ?? "",
    amountPaid: Number(receipt.amount_paid),
    paymentMethod: receipt.payment_method,
  });

  try {
    await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Receipt ${receipt.receipt_number} from ${business?.name ?? "Aziiki"}`,
      html,
    });
  } catch (err) {
    // resendClient throws EmailSendError with a message that's already
    // written for a non-technical reader - pass it straight through rather
    // than re-wrapping it in technical framing.
    res.status(502).json({ error: err instanceof Error ? err.message : "We couldn't send this email right now. Please try again shortly." });
    return;
  }

  res.json({ message: `Receipt emailed to ${recipientEmail}.` });
});
