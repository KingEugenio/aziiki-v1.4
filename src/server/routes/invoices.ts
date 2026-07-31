import type { Request, Response } from "express";
import { Router } from "express";
import { invoiceCreateSchema, invoiceUpdateSchema } from "../validation/billing";
import { cached, invalidate } from "../redis";
import { calculateInvoiceTotals } from "../../lib/money";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailConfigured, sendTransactionalEmail } from "../email/resendClient";
import { renderInvoiceEmailHtml } from "../email/documentTemplates";
import { checkLowStockAndNotify } from "../notifications/lowStockCheck";
import { resolveBusinessCurrency } from "./crudFactory";

const LIST_CACHE_TTL_SECONDS = 45;

function fromRow(row: any, items: any[]) {
  return {
    id: row.id,
    businessId: row.business_id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id ?? undefined,
    customClientName: row.custom_client_name ?? undefined,
    date: row.date,
    dueDate: row.due_date,
    items: items
      .filter((item) => item.invoice_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ description: item.description, quantity: Number(item.quantity), rate: Number(item.rate) })),
    discount: Number(row.discount),
    taxRate: Number(row.tax_rate),
    status: row.status,
    partialPaidAmount: Number(row.partial_paid_amount),
    logoUrl: row.logo_url ?? undefined,
    currency: row.currency,
    exchangeRateToBusinessCurrency: Number(row.exchange_rate_to_business_currency),
  };
}

async function loadInvoicesWithItems(supabase: SupabaseClient) {
  const [{ data: invoices, error: invError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("invoice_items").select("*").limit(20000),
  ]);
  if (invError) throw invError;
  if (itemError) throw itemError;
  return { invoices: invoices ?? [], items: items ?? [] };
}

/**
 * When an invoice is marked Paid (on create or via update), auto-log a
 * matching income transaction and decrement matching inventory stock -
 * mirroring the original app's triggerInvoicePaidWorkflow, just done
 * server-side and atomically instead of via client-only state.
 */
export async function runPaidWorkflow(
  supabase: SupabaseClient,
  userId: string,
  invoiceRow: any,
  items: Array<{ description: string; quantity: number; rate: number }>,
  recipientEmail?: string | null
) {
  const totals = calculateInvoiceTotals(items, Number(invoiceRow.discount), Number(invoiceRow.tax_rate));

  const { error: txError } = await supabase.from("transactions").insert({
    user_id: userId,
    business_id: invoiceRow.business_id,
    customer_id: invoiceRow.customer_id,
    date: invoiceRow.date,
    type: "income",
    category: "Sales",
    amount: totals.total,
    description: `Automated Inflow: Settled Invoice ${invoiceRow.invoice_number}`,
    payment_method: "Mobile Money",
    currency: invoiceRow.currency,
    exchange_rate_to_business_currency: invoiceRow.exchange_rate_to_business_currency,
  });
  if (txError) console.error("[invoices] failed to log paid-invoice transaction:", txError.message);

  const { data: stock, error: stockError } = await supabase
    .from("inventory")
    .select("*")
    .eq("business_id", invoiceRow.business_id);
  if (stockError) {
    console.error("[invoices] failed to load inventory for stock decrement:", stockError.message);
    return;
  }

  for (const stockItem of stock ?? []) {
    const stockName = String(stockItem.name).toLowerCase().trim();
    const matched = items.find((invItem) => {
      const itemDesc = invItem.description.toLowerCase().trim();
      return itemDesc === stockName || stockName.includes(itemDesc) || itemDesc.includes(stockName);
    });
    if (!matched) continue;
    const oldQuantity = Number(stockItem.quantity);
    const newQuantity = Math.max(0, oldQuantity - matched.quantity);
    const { error: updateError } = await supabase
      .from("inventory")
      .update({ quantity: newQuantity })
      .eq("id", stockItem.id);
    if (updateError) {
      console.error("[invoices] failed to decrement stock:", updateError.message);
      continue;
    }
    await checkLowStockAndNotify({
      userId,
      businessId: invoiceRow.business_id,
      itemId: stockItem.id,
      itemName: stockItem.name,
      oldQuantity,
      newQuantity,
      minStockAlert: Number(stockItem.min_stock_alert),
      recipientEmail,
    });
  }

  await invalidate(`cache:transactions:${userId}`, `cache:inventory:${userId}`);
}

export const invoicesRouter = Router();

invoicesRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const cacheKey = `cache:invoices:${userId}`;

  const { invoices, items } = await cached(cacheKey, LIST_CACHE_TTL_SECONDS, () => loadInvoicesWithItems(supabase));

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  const rows = businessId ? invoices.filter((r: any) => r.business_id === businessId) : invoices;
  res.json({ data: rows.map((row: any) => fromRow(row, items)) });
});

invoicesRouter.post("/", async (req: Request, res: Response) => {
  const parsed = invoiceCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  // Preserve an explicitly-provided number (e.g. importing historical
  // records); otherwise reserve the next one atomically so two concurrent
  // "new invoice" requests can never collide.
  let invoiceNumber = input.invoiceNumber;
  if (!invoiceNumber) {
    const { data: reserved, error: numberError } = await supabase.rpc("next_document_number", {
      p_business_id: input.businessId,
      p_document_type: "invoice",
      p_default_prefix: "INV",
    });
    if (numberError) {
      res.status(400).json({ error: numberError.message });
      return;
    }
    invoiceNumber = reserved as string;
  }

  const currency = input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId));

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: userId,
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      custom_client_name: input.customClientName ?? null,
      invoice_number: invoiceNumber,
      date: input.date,
      due_date: input.dueDate,
      discount: input.discount,
      tax_rate: input.taxRate,
      status: input.status,
      partial_paid_amount: input.partialPaidAmount,
      currency,
      exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
    })
    .select("*")
    .single();

  if (invoiceError) {
    res.status(400).json({ error: invoiceError.message });
    return;
  }

  // Normalized to plain required-field objects: Zod already guarantees these
  // are present (invoiceCreateSchema requires them), this just keeps
  // TypeScript's view of the shape in sync at every call site below.
  const validatedItems = input.items.map((item) => ({
    description: String(item.description),
    quantity: Number(item.quantity),
    rate: Number(item.rate),
  }));

  const itemRows = validatedItems.map((item, index) => ({
    invoice_id: invoice.id,
    user_id: userId,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    position: index,
  }));

  const { data: insertedItems, error: itemsError } = await supabase.from("invoice_items").insert(itemRows).select("*");

  if (itemsError) {
    // Compensating action: don't leave an invoice with no line items behind.
    await supabase.from("invoices").delete().eq("id", invoice.id);
    res.status(400).json({ error: itemsError.message });
    return;
  }

  if (input.status === "Paid") {
    await runPaidWorkflow(supabase, userId, invoice, validatedItems, req.user!.email);
  }

  await invalidate(`cache:invoices:${userId}`);
  res.status(201).json({ data: fromRow(invoice, insertedItems ?? []) });
});

invoicesRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = invoiceUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  const { data: existing, error: existingError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (existingError) {
    res.status(400).json({ error: existingError.message });
    return;
  }
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const row: Record<string, unknown> = {};
  if (input.invoiceNumber !== undefined) row.invoice_number = input.invoiceNumber;
  if (input.customerId !== undefined) row.customer_id = input.customerId ?? null;
  if (input.customClientName !== undefined) row.custom_client_name = input.customClientName ?? null;
  if (input.date !== undefined) row.date = input.date;
  if (input.dueDate !== undefined) row.due_date = input.dueDate;
  if (input.discount !== undefined) row.discount = input.discount;
  if (input.taxRate !== undefined) row.tax_rate = input.taxRate;
  if (input.status !== undefined) row.status = input.status;
  if (input.partialPaidAmount !== undefined) row.partial_paid_amount = input.partialPaidAmount;
  if (input.currency !== undefined) row.currency = input.currency;
  if (input.exchangeRateToBusinessCurrency !== undefined) row.exchange_rate_to_business_currency = input.exchangeRateToBusinessCurrency;

  const { data: updated, error: updateError } =
    Object.keys(row).length > 0
      ? await supabase.from("invoices").update(row).eq("id", existing.id).select("*").single()
      : { data: existing, error: null };

  if (updateError) {
    res.status(400).json({ error: updateError.message });
    return;
  }

  let items: any[];
  if (input.items) {
    await supabase.from("invoice_items").delete().eq("invoice_id", existing.id);
    const itemRows = input.items.map((item, index) => ({
      invoice_id: existing.id,
      user_id: userId,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      position: index,
    }));
    const { data: insertedItems, error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemRows)
      .select("*");
    if (itemsError) {
      res.status(400).json({ error: itemsError.message });
      return;
    }
    items = insertedItems ?? [];
  } else {
    const { data: existingItems } = await supabase.from("invoice_items").select("*").eq("invoice_id", existing.id);
    items = existingItems ?? [];
  }

  if (input.status === "Paid" && existing.status !== "Paid") {
    await runPaidWorkflow(
      supabase,
      userId,
      updated,
      items.map((item) => ({ description: item.description, quantity: Number(item.quantity), rate: Number(item.rate) })),
      req.user!.email
    );
  }

  await invalidate(`cache:invoices:${userId}`);
  res.json({ data: fromRow(updated, items) });
});

invoicesRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("invoices")
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

  await invalidate(`cache:invoices:${userId}`);
  res.status(204).send();
});

invoicesRouter.post("/:id/send-email", async (req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    res.status(503).json({ error: "Email sending is not configured on this server (RESEND_API_KEY is not set)." });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (invoiceError) {
    res.status(400).json({ error: invoiceError.message });
    return;
  }
  if (!invoice) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [{ data: items }, { data: business }, { data: customer }] = await Promise.all([
    supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id).order("position", { ascending: true }),
    supabase.from("businesses").select("name").eq("id", invoice.business_id).single(),
    invoice.customer_id
      ? supabase.from("customers").select("name, email").eq("id", invoice.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const recipientEmail = customer?.email;
  if (!recipientEmail) {
    res.status(400).json({ error: "This customer has no email address on file." });
    return;
  }

  const html = renderInvoiceEmailHtml({
    business: { name: business?.name ?? "Your Business" },
    currency: invoice.currency,
    invoiceNumber: invoice.invoice_number,
    date: invoice.date,
    dueDate: invoice.due_date,
    customerName: customer?.name ?? invoice.custom_client_name ?? "Valued Customer",
    items: (items ?? []).map((i: any) => ({ description: i.description, quantity: Number(i.quantity), rate: Number(i.rate) })),
    discount: Number(invoice.discount),
    taxRate: Number(invoice.tax_rate),
  });

  try {
    await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Invoice ${invoice.invoice_number} from ${business?.name ?? "Aziiki"}`,
      html,
    });
  } catch (err) {
    // resendClient throws EmailSendError with a message that's already
    // written for a non-technical reader - pass it straight through rather
    // than re-wrapping it in technical framing.
    res.status(502).json({ error: err instanceof Error ? err.message : "We couldn't send this email right now. Please try again shortly." });
    return;
  }

  res.json({ message: `Invoice emailed to ${recipientEmail}.` });
});
