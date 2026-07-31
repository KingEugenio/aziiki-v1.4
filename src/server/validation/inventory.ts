import { z } from "zod";
import { moneyField, nonEmptyString, uuidField } from "./common";

export const inventoryItemSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField,
  name: nonEmptyString.max(200),
  sku: z.string().trim().max(80).optional(),
  quantity: z.number().finite().nonnegative(),
  minStockAlert: z.number().finite().nonnegative().default(0),
  unitCost: moneyField,
  unitPrice: moneyField,
  supplierName: z.string().trim().max(200).optional(),
  supplierContact: z.string().trim().max(120).optional(),
});

export const inventoryStockAdjustmentSchema = z.object({
  delta: z.number().finite(),
});
