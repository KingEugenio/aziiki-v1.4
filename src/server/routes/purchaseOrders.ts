import type { Request, Response } from "express";
import { Router } from "express";
import { purchaseOrderCreateSchema, purchaseOrderUpdateSchema } from "../validation/billing";
import { cached, invalidate } from "../redis";
import { calculateInvoiceTotals } from "../../lib/money";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBusinessCurrency } from "./crudFactory";

const LIST_CACHE_TTL_SECONDS = 45;

function fromRow(row: any, items: any[]) {
  return {
    id: row.id,
    businessId: row.business_id,
    poNumber: row.po_number,
    supplierName: row.supplier_name,
    supplierContact: row.supplier_contact ?? undefined,
    date: row.date,
    expectedDeliveryDate: row.expected_delivery_date ?? undefined,
    items: items
      .filter((item) => item.purchase_order_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ description: item.description, quantity: Number(item.quantity), rate: Number(item.rate) })),
    discount: Number(row.discount),
    totalAmount: Number(row.total_amount),
    status: row.status,
    notes: row.notes ?? undefined,
    currency: row.currency,
    exchangeRateToBusinessCurrency: Number(row.exchange_rate_to_business_currency),
  };
}

async function loadPurchaseOrdersWithItems(supabase: SupabaseClient) {
  const [{ data: purchaseOrders, error: pError }, { data: items, error: itemError }] = await Promise.all([
    supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("purchase_order_items").select("*").limit(20000),
  ]);
  if (pError) throw pError;
  if (itemError) throw itemError;
  return { purchaseOrders: purchaseOrders ?? [], items: items ?? [] };
}

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const cacheKey = `cache:purchase_orders:${userId}`;

  const { purchaseOrders, items } = await cached(cacheKey, LIST_CACHE_TTL_SECONDS, () => loadPurchaseOrdersWithItems(supabase));

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  const rows = businessId ? purchaseOrders.filter((r: any) => r.business_id === businessId) : purchaseOrders;
  res.json({ data: rows.map((row: any) => fromRow(row, items)) });
});

purchaseOrdersRouter.post("/", async (req: Request, res: Response) => {
  const parsed = purchaseOrderCreateSchema.safeParse(req.body);
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

  let poNumber = input.poNumber;
  if (!poNumber) {
    const { data: reserved, error: numberError } = await supabase.rpc("next_document_number", {
      p_business_id: input.businessId,
      p_document_type: "purchase_order",
      p_default_prefix: "PO",
    });
    if (numberError) {
      res.status(400).json({ error: numberError.message });
      return;
    }
    poNumber = reserved as string;
  }

  const currency = input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId));

  const { data: purchaseOrder, error: purchaseOrderError } = await supabase
    .from("purchase_orders")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: userId,
      business_id: input.businessId,
      supplier_name: input.supplierName,
      supplier_contact: input.supplierContact ?? null,
      po_number: poNumber,
      date: input.date,
      expected_delivery_date: input.expectedDeliveryDate ?? null,
      discount: input.discount,
      total_amount: totals.total,
      status: input.status,
      notes: input.notes ?? null,
      currency,
      exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
    })
    .select("*")
    .single();

  if (purchaseOrderError) {
    res.status(400).json({ error: purchaseOrderError.message });
    return;
  }

  const itemRows = validatedItems.map((item, index) => ({
    purchase_order_id: purchaseOrder.id,
    user_id: userId,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    position: index,
  }));

  const { data: insertedItems, error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(itemRows)
    .select("*");

  if (itemsError) {
    await supabase.from("purchase_orders").delete().eq("id", purchaseOrder.id);
    res.status(400).json({ error: itemsError.message });
    return;
  }

  await invalidate(`cache:purchase_orders:${userId}`);
  res.status(201).json({ data: fromRow(purchaseOrder, insertedItems ?? []) });
});

purchaseOrdersRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = purchaseOrderUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  const { data: existing, error: existingError } = await supabase
    .from("purchase_orders")
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
    await supabase.from("purchase_order_items").delete().eq("purchase_order_id", existing.id);
    const itemRows = input.items.map((item, index) => ({
      purchase_order_id: existing.id,
      user_id: userId,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      position: index,
    }));
    const { data: insertedItems, error: itemsError } = await supabase
      .from("purchase_order_items")
      .insert(itemRows)
      .select("*");
    if (itemsError) {
      res.status(400).json({ error: itemsError.message });
      return;
    }
    items = insertedItems ?? [];
  } else {
    const { data: existingItems } = await supabase.from("purchase_order_items").select("*").eq("purchase_order_id", existing.id);
    items = existingItems ?? [];
  }

  const discount = input.discount ?? Number(existing.discount);
  const totals = calculateInvoiceTotals(
    items.map((i) => ({ quantity: Number(i.quantity), rate: Number(i.rate) })),
    discount,
    0
  );

  const row: Record<string, unknown> = { total_amount: totals.total };
  if (input.supplierName !== undefined) row.supplier_name = input.supplierName;
  if (input.supplierContact !== undefined) row.supplier_contact = input.supplierContact ?? null;
  if (input.poNumber !== undefined) row.po_number = input.poNumber;
  if (input.date !== undefined) row.date = input.date;
  if (input.expectedDeliveryDate !== undefined) row.expected_delivery_date = input.expectedDeliveryDate ?? null;
  if (input.discount !== undefined) row.discount = input.discount;
  if (input.status !== undefined) row.status = input.status;
  if (input.notes !== undefined) row.notes = input.notes ?? null;
  if (input.currency !== undefined) row.currency = input.currency;
  if (input.exchangeRateToBusinessCurrency !== undefined) row.exchange_rate_to_business_currency = input.exchangeRateToBusinessCurrency;

  const { data: updated, error: updateError } = await supabase
    .from("purchase_orders")
    .update(row)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (updateError) {
    res.status(400).json({ error: updateError.message });
    return;
  }

  await invalidate(`cache:purchase_orders:${userId}`);
  res.json({ data: fromRow(updated, items) });
});

purchaseOrdersRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("purchase_orders")
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

  await invalidate(`cache:purchase_orders:${userId}`);
  res.status(204).send();
});
