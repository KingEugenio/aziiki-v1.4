import { createCrudRouter } from "./crudFactory";
import { businessCreateSchema, businessUpdateSchema } from "../validation/businesses";
import type { z } from "zod";

type CreateInput = z.infer<typeof businessCreateSchema>;
type UpdateInput = z.infer<typeof businessUpdateSchema>;

interface BusinessRow {
  id: string;
  name: string;
  industry: string | null;
  logo: string | null;
  primary_color: string | null;
  tax_rate: number;
  currency: string;
  description: string | null;
  business_type: string | null;
  allow_financial_approvals: boolean;
  is_personal: boolean;
  locked: boolean;
  country_code: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export const businessesRouter = createCrudRouter<CreateInput, UpdateInput, BusinessRow, unknown>({
  table: "businesses",
  cacheKeyPrefix: "businesses",
  createSchema: businessCreateSchema,
  updateSchema: businessUpdateSchema,
  toInsertRow: (_userId, input) => ({
    ...(input.id ? { id: input.id } : {}),
    name: input.name,
    industry: input.industry,
    logo: input.logo,
    primary_color: input.primaryColor,
    tax_rate: input.taxRate,
    currency: input.currency,
    description: input.description,
    business_type: input.businessType,
    allow_financial_approvals: input.allowFinancialApprovals ?? false,
    is_personal: input.isPersonal ?? false,
    locked: input.locked ?? false,
    country_code: input.countryCode ?? null,
    timezone: input.timezone ?? null,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.industry !== undefined) row.industry = input.industry;
    if (input.logo !== undefined) row.logo = input.logo;
    if (input.primaryColor !== undefined) row.primary_color = input.primaryColor;
    if (input.taxRate !== undefined) row.tax_rate = input.taxRate;
    if (input.currency !== undefined) row.currency = input.currency;
    if (input.description !== undefined) row.description = input.description;
    if (input.businessType !== undefined) row.business_type = input.businessType;
    if (input.allowFinancialApprovals !== undefined) row.allow_financial_approvals = input.allowFinancialApprovals;
    if (input.isPersonal !== undefined) row.is_personal = input.isPersonal;
    if (input.locked !== undefined) row.locked = input.locked;
    if (input.countryCode !== undefined) row.country_code = input.countryCode ?? null;
    if (input.timezone !== undefined) row.timezone = input.timezone ?? null;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    name: row.name,
    industry: row.industry ?? "",
    logo: row.logo ?? "",
    primaryColor: row.primary_color ?? "",
    taxRate: Number(row.tax_rate),
    currency: row.currency,
    description: row.description ?? "",
    businessType: row.business_type ?? undefined,
    allowFinancialApprovals: row.allow_financial_approvals,
    isPersonal: row.is_personal,
    locked: row.locked,
    countryCode: row.country_code ?? undefined,
    timezone: row.timezone ?? undefined,
  }),
});
