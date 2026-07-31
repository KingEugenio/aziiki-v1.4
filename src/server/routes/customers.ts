import { createCrudRouter } from "./crudFactory";
import { customerSchema } from "../validation/billing";
import { z } from "zod";

type CustomerInput = z.infer<typeof customerSchema>;
interface CustomerRow {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  category: string | null;
  avatar_color: string | null;
  preferred_currency: string | null;
}

export const customersRouter = createCrudRouter<CustomerInput, Partial<CustomerInput>, CustomerRow, unknown>({
  table: "customers",
  cacheKeyPrefix: "customers",
  supportsBusinessFilter: true,
  createSchema: customerSchema,
  updateSchema: customerSchema.partial(),
  toInsertRow: (_userId, input) => ({
    ...(input.id ? { id: input.id } : {}),
    business_id: input.businessId,
    name: input.name,
    email: input.email || null,
    phone: input.phone,
    notes: input.notes,
    category: input.category,
    avatar_color: input.avatarColor,
    preferred_currency: input.preferredCurrency || null,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.email !== undefined) row.email = input.email || null;
    if (input.phone !== undefined) row.phone = input.phone;
    if (input.notes !== undefined) row.notes = input.notes;
    if (input.category !== undefined) row.category = input.category;
    if (input.avatarColor !== undefined) row.avatar_color = input.avatarColor;
    if (input.preferredCurrency !== undefined) row.preferred_currency = input.preferredCurrency || null;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    notes: row.notes ?? "",
    category: row.category ?? "",
    avatarColor: row.avatar_color ?? "bg-slate-500",
    preferredCurrency: row.preferred_currency ?? "",
  }),
});
