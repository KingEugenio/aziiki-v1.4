import type { Request, Response } from "express";
import { Router } from "express";
import { quotationCreateSchema, quotationUpdateSchema } from "../validation/billing";
import { cached, invalidate } from "../redis";
import { calculateInvoiceTotals } from "../../lib/money";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { resolveBusinessCurrency } from "./crudFactory";

const LIST_CACHE_TTL_SECONDS = 45;

function fromRow(row: any, items: any[]) {
  return {
    id: row.id,
    businessId: row.business_id,
    quoteNumber: row.quote_number,
    customerId: row.customer_id ?? undefined,
    customClientName: row.custom_client_name ?? undefined,
    date: row.date,
    validUntil: row.valid_until,
    items: items
      .filter((item) => item.quotation_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ description: item.description, quantity: Number(item.quantity), rate: Number(item.rate) })),
    discount: Number(row.discount),
    totalAmount: Number(row.total_amount),
    status: row.status,
    currency: row.currency,
    exchangeRateToBusinessCurrency: Number(row.exchange_rate_to_business_currency),
  };
}

async function loadQuotationsWithItems(supabase: SupabaseClient) {
  const [{ data: quotations, error: qError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from("quotations").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("quotation_items").select("*").limit(20000),
  ]);
  if (qError) throw qError;
  if (itemError) throw itemError;
  return { quotations: quotations ?? [], items: items ?? [] };
}

export const quotationsRouter = Router();

quotationsRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const cacheKey = `cache:quotations:${userId}`;

  const { quotations, items } = await cached(cacheKey, LIST_CACHE_TTL_SECONDS, () => loadQuotationsWithItems(supabase));

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  const rows = businessId ? quotations.filter((r: any) => r.business_id === businessId) : quotations;
  res.json({ data: rows.map((row: any) => fromRow(row, items)) });
});

quotationsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = quotationCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;
  const validatedItems = input.items.map((item) => ({
    description: String(item.description),
    quantity: Number(item.quantity),
    rate: Number(item.rate),
  }));
  const totals = calculateInvoiceTotals(validatedItems, input.discount, 0);

  let quoteNumber = input.quoteNumber;
  if (!quoteNumber) {
    const { data: reserved, error: numberError } = await supabase.rpc("next_document_number", {
      p_business_id: input.businessId,
      p_document_type: "quotation",
      p_default_prefix: "EST",
    });
    if (numberError) {
      res.status(400).json({ error: numberError.message });
      return;
    }
    quoteNumber = reserved as string;
  }

  const currency = input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId));

  const { data: quotation, error: quotationError } = await supabase
    .from("quotations")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: userId,
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      custom_client_name: input.customClientName ?? null,
      quote_number: quoteNumber,
      date: input.date,
      valid_until: input.validUntil,
      discount: input.discount,
      total_amount: totals.total,
      status: input.status,
      currency,
      exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
    })
    .select("*")
    .single();

  if (quotationError) {
    res.status(400).json({ error: quotationError.message });
    return;
  }

  const itemRows = validatedItems.map((item, index) => ({
    quotation_id: quotation.id,
    user_id: userId,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    position: index,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from("quotation_items")
    .insert(itemRows)
    .select("*");

  if (itemsError) {
    await supabase.from("quotations").delete().eq("id", quotation.id);
    res.status(400).json({ error: itemsError.message });
    return;
  }

  await invalidate(`cache:quotations:${userId}`);
  res.status(201).json({ data: fromRow(quotation, insertedItems ?? []) });
});

quotationsRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = quotationUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  const { data: existing, error: existingError } = await supabase
    .from("quotations")
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

  let items: any[];
  if (input.items) {
    await supabase.from("quotation_items").delete().eq("quotation_id", existing.id);
    const itemRows = input.items.map((item, index) => ({
      quotation_id: existing.id,
      user_id: userId,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      position: index,
    }));
    const { data: insertedItems, error: itemsError } = await supabase
      .from("quotation_items")
      .insert(itemRows)
      .select("*");
    if (itemsError) {
      res.status(400).json({ error: itemsError.message });
      return;
    }
    items = insertedItems ?? [];
  } else {
    const { data: existingItems } = await supabase.from("quotation_items").select("*").eq("quotation_id", existing.id);
    items = existingItems ?? [];
  }

  const discount = input.discount ?? Number(existing.discount);
  const totals = calculateInvoiceTotals(
    items.map((i) => ({ quantity: Number(i.quantity), rate: Number(i.rate) })),
    discount,
    0
  );

  const row: Record<string, unknown> = { total_amount: totals.total };
  if (input.customerId !== undefined) row.customer_id = input.customerId ?? null;
  if (input.customClientName !== undefined) row.custom_client_name = input.customClientName ?? null;
  if (input.quoteNumber !== undefined) row.quote_number = input.quoteNumber;
  if (input.date !== undefined) row.date = input.date;
  if (input.validUntil !== undefined) row.valid_until = input.validUntil;
  if (input.discount !== undefined) row.discount = input.discount;
  if (input.status !== undefined) row.status = input.status;
  if (input.currency !== undefined) row.currency = input.currency;
  if (input.exchangeRateToBusinessCurrency !== undefined) row.exchange_rate_to_business_currency = input.exchangeRateToBusinessCurrency;

  const { data: updated, error: updateError } = await supabase
    .from("quotations")
    .update(row)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (updateError) {
    res.status(400).json({ error: updateError.message });
    return;
  }

  await invalidate(`cache:quotations:${userId}`);
  res.json({ data: fromRow(updated, items) });
});

quotationsRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("quotations")
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

  await invalidate(`cache:quotations:${userId}`);
  res.status(204).send();
});

const convertSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(60),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taxRate: z.number().finite().min(0).max(100),
});

// Converts an accepted quotation into a Draft invoice carrying the same
// line items, and marks the quotation Converted.
quotationsRouter.post("/:id/convert-to-invoice", async (req: Request, res: Response) => {
  const parsed = convertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: quotation, error: quotationError } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (quotationError) {
    res.status(400).json({ error: quotationError.message });
    return;
  }
  if (!quotation) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { data: items, error: itemsError } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotation.id)
    .order("position", { ascending: true });

  if (itemsError) {
    res.status(400).json({ error: itemsError.message });
    return;
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      business_id: quotation.business_id,
      customer_id: quotation.customer_id,
      custom_client_name: quotation.custom_client_name,
      invoice_number: parsed.data.invoiceNumber,
      date: new Date().toISOString().slice(0, 10),
      due_date: parsed.data.dueDate,
      discount: quotation.discount,
      tax_rate: parsed.data.taxRate,
      status: "Draft",
      partial_paid_amount: 0,
      currency: quotation.currency,
      exchange_rate_to_business_currency: quotation.exchange_rate_to_business_currency,
    })
    .select("*")
    .single();

  if (invoiceError) {
    res.status(400).json({ error: invoiceError.message });
    return;
  }

  const invoiceItemRows = (items ?? []).map((item: any, index: number) => ({
    invoice_id: invoice.id,
    user_id: userId,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    position: index,
  }));

  const { data: insertedItems, error: insertItemsError } = await supabase
    .from("invoice_items")
    .insert(invoiceItemRows)
    .select("*");

  if (insertItemsError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    res.status(400).json({ error: insertItemsError.message });
    return;
  }

  await supabase.from("quotations").update({ status: "Converted" }).eq("id", quotation.id);

  await invalidate(`cache:quotations:${userId}`, `cache:invoices:${userId}`);

  res.status(201).json({
    invoice: {
      id: invoice.id,
      businessId: invoice.business_id,
      invoiceNumber: invoice.invoice_number,
      customerId: invoice.customer_id ?? undefined,
      customClientName: invoice.custom_client_name ?? undefined,
      date: invoice.date,
      dueDate: invoice.due_date,
      items: (insertedItems ?? []).map((item: any) => ({
        description: item.description,
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      })),
      discount: Number(invoice.discount),
      taxRate: Number(invoice.tax_rate),
      status: invoice.status,
      partialPaidAmount: Number(invoice.partial_paid_amount),
      currency: invoice.currency,
      exchangeRateToBusinessCurrency: Number(invoice.exchange_rate_to_business_currency),
    },
  });
});
