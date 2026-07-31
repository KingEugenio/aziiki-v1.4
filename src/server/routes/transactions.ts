import { createCrudRouter, resolveBusinessCurrency } from "./crudFactory";
import { transactionSchema } from "../validation/billing";
import { z } from "zod";

type TransactionInput = z.infer<typeof transactionSchema>;
interface TransactionRow {
  id: string;
  business_id: string;
  date: string;
  type: string;
  category: string;
  amount: number;
  description: string | null;
  payment_method: string;
  customer_id: string | null;
  proof_uri: string | null;
  currency: string;
  exchange_rate_to_business_currency: number;
}

export const transactionsRouter = createCrudRouter<
  TransactionInput,
  Partial<TransactionInput>,
  TransactionRow,
  unknown
>({
  table: "transactions",
  cacheKeyPrefix: "transactions",
  supportsBusinessFilter: true,
  createSchema: transactionSchema,
  updateSchema: transactionSchema.partial(),
  toInsertRow: async (_userId, input, supabase) => ({
    ...(input.id ? { id: input.id } : {}),
    business_id: input.businessId,
    date: input.date,
    type: input.type,
    category: input.category,
    amount: input.amount,
    description: input.description,
    payment_method: input.paymentMethod,
    customer_id: input.customerId ?? null,
    proof_uri: input.proofUri,
    currency: input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId)),
    exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.date !== undefined) row.date = input.date;
    if (input.type !== undefined) row.type = input.type;
    if (input.category !== undefined) row.category = input.category;
    if (input.amount !== undefined) row.amount = input.amount;
    if (input.description !== undefined) row.description = input.description;
    if (input.paymentMethod !== undefined) row.payment_method = input.paymentMethod;
    if (input.customerId !== undefined) row.customer_id = input.customerId ?? null;
    if (input.proofUri !== undefined) row.proof_uri = input.proofUri;
    if (input.currency !== undefined) row.currency = input.currency;
    if (input.exchangeRateToBusinessCurrency !== undefined) row.exchange_rate_to_business_currency = input.exchangeRateToBusinessCurrency;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    date: row.date,
    type: row.type,
    category: row.category,
    amount: Number(row.amount),
    description: row.description ?? "",
    paymentMethod: row.payment_method,
    customerId: row.customer_id ?? undefined,
    proofUri: row.proof_uri ?? undefined,
    currency: row.currency,
    exchangeRateToBusinessCurrency: Number(row.exchange_rate_to_business_currency),
  }),
});
