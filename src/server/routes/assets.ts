import { createCrudRouter } from "./crudFactory";
import { assetSchema } from "../validation/wealth";
import { z } from "zod";

type AssetInput = z.infer<typeof assetSchema>;
interface AssetRow {
  id: string;
  business_id: string | null;
  name: string;
  category: string;
  purchase_date: string;
  purchase_price: number;
  current_value: number;
  depreciation_method: string | null;
  useful_life_years: number | null;
  salvage_value: number | null;
  maintenance_last_date: string | null;
  maintenance_next_date: string | null;
  maintenance_status: string | null;
  maintenance_notes: string | null;
  documents_notes: string | null;
  notes: string | null;
}

export const assetsRouter = createCrudRouter<AssetInput, Partial<AssetInput>, AssetRow, unknown>({
  table: "assets",
  cacheKeyPrefix: "assets",
  supportsBusinessFilter: true,
  createSchema: assetSchema,
  updateSchema: assetSchema.partial(),
  toInsertRow: (_userId, input) => ({
    ...(input.id ? { id: input.id } : {}),
    business_id: input.businessId ?? null,
    name: input.name,
    category: input.category,
    purchase_date: input.purchaseDate,
    purchase_price: input.purchasePrice,
    current_value: input.currentValue,
    depreciation_method: input.depreciationMethod,
    useful_life_years: input.usefulLifeYears,
    salvage_value: input.salvageValue,
    maintenance_last_date: input.maintenanceLastDate,
    maintenance_next_date: input.maintenanceNextDate,
    maintenance_status: input.maintenanceStatus,
    maintenance_notes: input.maintenanceNotes,
    documents_notes: input.documentsNotes,
    notes: input.notes,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.businessId !== undefined) row.business_id = input.businessId ?? null;
    if (input.name !== undefined) row.name = input.name;
    if (input.category !== undefined) row.category = input.category;
    if (input.purchaseDate !== undefined) row.purchase_date = input.purchaseDate;
    if (input.purchasePrice !== undefined) row.purchase_price = input.purchasePrice;
    if (input.currentValue !== undefined) row.current_value = input.currentValue;
    if (input.depreciationMethod !== undefined) row.depreciation_method = input.depreciationMethod;
    if (input.usefulLifeYears !== undefined) row.useful_life_years = input.usefulLifeYears;
    if (input.salvageValue !== undefined) row.salvage_value = input.salvageValue;
    if (input.maintenanceLastDate !== undefined) row.maintenance_last_date = input.maintenanceLastDate;
    if (input.maintenanceNextDate !== undefined) row.maintenance_next_date = input.maintenanceNextDate;
    if (input.maintenanceStatus !== undefined) row.maintenance_status = input.maintenanceStatus;
    if (input.maintenanceNotes !== undefined) row.maintenance_notes = input.maintenanceNotes;
    if (input.documentsNotes !== undefined) row.documents_notes = input.documentsNotes;
    if (input.notes !== undefined) row.notes = input.notes;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id ?? undefined,
    name: row.name,
    category: row.category,
    purchaseDate: row.purchase_date,
    purchasePrice: Number(row.purchase_price),
    currentValue: Number(row.current_value),
    depreciationMethod: row.depreciation_method ?? undefined,
    usefulLifeYears: row.useful_life_years ?? undefined,
    salvageValue: row.salvage_value !== null ? Number(row.salvage_value) : undefined,
    maintenanceLastDate: row.maintenance_last_date ?? undefined,
    maintenanceNextDate: row.maintenance_next_date ?? undefined,
    maintenanceStatus: row.maintenance_status ?? undefined,
    maintenanceNotes: row.maintenance_notes ?? undefined,
    documentsNotes: row.documents_notes ?? undefined,
    notes: row.notes ?? "",
  }),
});
