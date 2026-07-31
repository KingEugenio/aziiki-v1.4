import { createCrudRouter } from "./crudFactory";
import { investmentSchema } from "../validation/wealth";
import { z } from "zod";

type InvestmentInput = z.infer<typeof investmentSchema>;
interface InvestmentRow {
  id: string;
  business_id: string | null;
  type: string;
  name: string;
  institution: string | null;
  value: number;
  amount_invested: number;
  maturity_date: string | null;
  expected_return_rate: number;
  date_acquired: string;
  notes: string | null;
}

export const investmentsRouter = createCrudRouter<InvestmentInput, Partial<InvestmentInput>, InvestmentRow, unknown>({
  table: "investments",
  cacheKeyPrefix: "investments",
  supportsBusinessFilter: true,
  createSchema: investmentSchema,
  updateSchema: investmentSchema.partial(),
  toInsertRow: (_userId, input) => ({
    ...(input.id ? { id: input.id } : {}),
    business_id: input.businessId ?? null,
    type: input.type,
    name: input.name,
    institution: input.institution,
    value: input.value,
    amount_invested: input.amountInvested,
    maturity_date: input.maturityDate ?? null,
    expected_return_rate: input.expectedReturnRate,
    date_acquired: input.dateAcquired,
    notes: input.notes,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.businessId !== undefined) row.business_id = input.businessId ?? null;
    if (input.type !== undefined) row.type = input.type;
    if (input.name !== undefined) row.name = input.name;
    if (input.institution !== undefined) row.institution = input.institution;
    if (input.value !== undefined) row.value = input.value;
    if (input.amountInvested !== undefined) row.amount_invested = input.amountInvested;
    if (input.maturityDate !== undefined) row.maturity_date = input.maturityDate ?? null;
    if (input.expectedReturnRate !== undefined) row.expected_return_rate = input.expectedReturnRate;
    if (input.dateAcquired !== undefined) row.date_acquired = input.dateAcquired;
    if (input.notes !== undefined) row.notes = input.notes;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id ?? undefined,
    type: row.type,
    name: row.name,
    institution: row.institution ?? "",
    value: Number(row.value),
    amountInvested: Number(row.amount_invested),
    maturityDate: row.maturity_date ?? undefined,
    expectedReturnRate: Number(row.expected_return_rate),
    dateAcquired: row.date_acquired,
    notes: row.notes ?? "",
  }),
});
