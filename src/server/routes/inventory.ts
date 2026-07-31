import type { Request, Response } from "express";
import { createCrudRouter } from "./crudFactory";
import { inventoryItemSchema, inventoryStockAdjustmentSchema } from "../validation/inventory";
import { invalidate } from "../redis";
import { checkLowStockAndNotify } from "../notifications/lowStockCheck";
import { z } from "zod";

type InventoryInput = z.infer<typeof inventoryItemSchema>;
interface InventoryRow {
  id: string;
  business_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  min_stock_alert: number;
  unit_cost: number;
  unit_price: number;
  supplier_name: string | null;
  supplier_contact: string | null;
}

export const inventoryRouter = createCrudRouter<InventoryInput, Partial<InventoryInput>, InventoryRow, unknown>({
  table: "inventory",
  cacheKeyPrefix: "inventory",
  supportsBusinessFilter: true,
  createSchema: inventoryItemSchema,
  updateSchema: inventoryItemSchema.partial(),
  toInsertRow: (_userId, input) => ({
    ...(input.id ? { id: input.id } : {}),
    business_id: input.businessId,
    name: input.name,
    sku: input.sku,
    quantity: input.quantity,
    min_stock_alert: input.minStockAlert,
    unit_cost: input.unitCost,
    unit_price: input.unitPrice,
    supplier_name: input.supplierName,
    supplier_contact: input.supplierContact,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.sku !== undefined) row.sku = input.sku;
    if (input.quantity !== undefined) row.quantity = input.quantity;
    if (input.minStockAlert !== undefined) row.min_stock_alert = input.minStockAlert;
    if (input.unitCost !== undefined) row.unit_cost = input.unitCost;
    if (input.unitPrice !== undefined) row.unit_price = input.unitPrice;
    if (input.supplierName !== undefined) row.supplier_name = input.supplierName;
    if (input.supplierContact !== undefined) row.supplier_contact = input.supplierContact;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    sku: row.sku ?? "",
    quantity: Number(row.quantity),
    minStockAlert: Number(row.min_stock_alert),
    unitCost: Number(row.unit_cost),
    unitPrice: Number(row.unit_price),
    supplierName: row.supplier_name ?? "",
    supplierContact: row.supplier_contact ?? "",
  }),
});

inventoryRouter.post("/:id/adjust", async (req: Request, res: Response) => {
  const parsed = inventoryStockAdjustmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: item, error: itemError } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (itemError) {
    res.status(400).json({ error: itemError.message });
    return;
  }
  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const newQuantity = Math.max(0, Number(item.quantity) + parsed.data.delta);

  const { data: updated, error: updateError } = await supabase
    .from("inventory")
    .update({ quantity: newQuantity })
    .eq("id", item.id)
    .select("*")
    .single();

  if (updateError) {
    res.status(400).json({ error: updateError.message });
    return;
  }

  await checkLowStockAndNotify({
    userId,
    businessId: item.business_id,
    itemId: item.id,
    itemName: item.name,
    oldQuantity: Number(item.quantity),
    newQuantity,
    minStockAlert: Number(item.min_stock_alert),
    recipientEmail: req.user!.email,
  });

  await invalidate(`cache:inventory:${userId}`);
  res.json({
    data: {
      id: updated.id,
      businessId: updated.business_id,
      name: updated.name,
      sku: updated.sku ?? "",
      quantity: Number(updated.quantity),
      minStockAlert: Number(updated.min_stock_alert),
      unitCost: Number(updated.unit_cost),
      unitPrice: Number(updated.unit_price),
      supplierName: updated.supplier_name ?? "",
      supplierContact: updated.supplier_contact ?? "",
    },
  });
});
