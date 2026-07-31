import { createCrudRouter } from "./crudFactory";
import { personalAccountSchema, personalBudgetSchema } from "../validation/businesses";
import { z } from "zod";

type AccountInput = z.infer<typeof personalAccountSchema>;
interface AccountRow {
  id: string;
  business_id: string;
  name: string;
  type: string;
  initial_balance: number;
  balance: number;
}

export const personalAccountsRouter = createCrudRouter<AccountInput, Partial<AccountInput>, AccountRow, unknown>({
  table: "personal_accounts",
  cacheKeyPrefix: "personal_accounts",
  supportsBusinessFilter: true,
  createSchema: personalAccountSchema,
  updateSchema: personalAccountSchema.partial(),
  toInsertRow: (_userId, input) => ({
    business_id: input.businessId,
    name: input.name,
    type: input.type,
    initial_balance: input.initialBalance,
    balance: input.balance,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.name !== undefined) row.name = input.name;
    if (input.type !== undefined) row.type = input.type;
    if (input.initialBalance !== undefined) row.initial_balance = input.initialBalance;
    if (input.balance !== undefined) row.balance = input.balance;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    type: row.type,
    initialBalance: Number(row.initial_balance),
    balance: Number(row.balance),
  }),
});

type BudgetInput = z.infer<typeof personalBudgetSchema>;
interface BudgetRow {
  id: string;
  business_id: string;
  category: string;
  limit_amount: number;
}

export const personalBudgetsRouter = createCrudRouter<BudgetInput, Partial<BudgetInput>, BudgetRow, unknown>({
  table: "personal_budgets",
  cacheKeyPrefix: "personal_budgets",
  supportsBusinessFilter: true,
  createSchema: personalBudgetSchema,
  updateSchema: personalBudgetSchema.partial(),
  toInsertRow: (_userId, input) => ({
    business_id: input.businessId,
    category: input.category,
    limit_amount: input.limitAmount,
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.category !== undefined) row.category = input.category;
    if (input.limitAmount !== undefined) row.limit_amount = input.limitAmount;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    category: row.category,
    limitAmount: Number(row.limit_amount),
  }),
});
