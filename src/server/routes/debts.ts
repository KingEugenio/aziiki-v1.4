import type { Request, Response } from "express";
import { createCrudRouter, resolveBusinessCurrency } from "./crudFactory";
import { debtSchema, debtRepaymentSchema } from "../validation/wealth";
import { invalidate } from "../redis";
import { subtractMoney } from "../../lib/money";
import { z } from "zod";

type DebtInput = z.infer<typeof debtSchema>;
interface DebtRow {
  id: string;
  business_id: string | null;
  creditor: string;
  amount: number;
  interest_rate: number;
  due_date: string;
  type: string;
  currency: string;
}

export const debtsRouter = createCrudRouter<DebtInput, Partial<DebtInput>, DebtRow, unknown>({
  table: "debts",
  cacheKeyPrefix: "debts",
  supportsBusinessFilter: true,
  createSchema: debtSchema,
  updateSchema: debtSchema.partial(),
  toInsertRow: async (_userId, input, supabase) => ({
    ...(input.id ? { id: input.id } : {}),
    business_id: input.businessId ?? null,
    creditor: input.creditor,
    amount: input.amount,
    interest_rate: input.interestRate,
    due_date: input.dueDate,
    type: input.type,
    currency: input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId)),
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.businessId !== undefined) row.business_id = input.businessId ?? null;
    if (input.creditor !== undefined) row.creditor = input.creditor;
    if (input.amount !== undefined) row.amount = input.amount;
    if (input.interestRate !== undefined) row.interest_rate = input.interestRate;
    if (input.dueDate !== undefined) row.due_date = input.dueDate;
    if (input.type !== undefined) row.type = input.type;
    if (input.currency !== undefined) row.currency = input.currency;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id ?? undefined,
    creditor: row.creditor,
    amount: Number(row.amount),
    interestRate: Number(row.interest_rate),
    dueDate: row.due_date,
    type: row.type,
    currency: row.currency,
  }),
});

// Repaying a debt reduces its balance; once it hits zero the debt is
// considered settled and removed (mirroring the original app's behavior).
debtsRouter.post("/:id/repay", async (req: Request, res: Response) => {
  const parsed = debtRepaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (debtError) {
    res.status(400).json({ error: debtError.message });
    return;
  }
  if (!debt) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const remaining = Math.max(0, subtractMoney(Number(debt.amount), parsed.data.amount));

  if (remaining === 0) {
    const { error: deleteError } = await supabase.from("debts").delete().eq("id", debt.id);
    if (deleteError) {
      res.status(400).json({ error: deleteError.message });
      return;
    }
    await invalidate(`cache:debts:${userId}`);
    res.json({ data: null, settled: true });
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("debts")
    .update({ amount: remaining })
    .eq("id", debt.id)
    .select("*")
    .single();

  if (updateError) {
    res.status(400).json({ error: updateError.message });
    return;
  }

  await invalidate(`cache:debts:${userId}`);
  res.json({
    data: {
      id: updated.id,
      businessId: updated.business_id ?? undefined,
      creditor: updated.creditor,
      amount: Number(updated.amount),
      interestRate: Number(updated.interest_rate),
      dueDate: updated.due_date,
      type: updated.type,
      currency: updated.currency,
    },
    settled: false,
  });
});
