import type { Request, Response } from "express";
import { createCrudRouter, resolveBusinessCurrency, convertViaBusinessCurrency } from "./crudFactory";
import { goalSchema, goalContributionSchema } from "../validation/wealth";
import { invalidate } from "../redis";
import { addMoney } from "../../lib/money";
import { z } from "zod";

type GoalInput = z.infer<typeof goalSchema>;
interface GoalRow {
  id: string;
  business_id: string;
  type: string;
  name: string;
  current_amount: number;
  target_amount: number;
  deadline: string;
  currency: string;
}

export const goalsRouter = createCrudRouter<GoalInput, Partial<GoalInput>, GoalRow, unknown>({
  table: "goals",
  cacheKeyPrefix: "goals",
  supportsBusinessFilter: true,
  createSchema: goalSchema,
  updateSchema: goalSchema.partial(),
  toInsertRow: async (_userId, input, supabase) => ({
    ...(input.id ? { id: input.id } : {}),
    business_id: input.businessId,
    type: input.type,
    name: input.name,
    current_amount: input.currentAmount,
    target_amount: input.targetAmount,
    deadline: input.deadline,
    currency: input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId)),
  }),
  toUpdateRow: (input) => {
    const row: Record<string, unknown> = {};
    if (input.type !== undefined) row.type = input.type;
    if (input.name !== undefined) row.name = input.name;
    if (input.currentAmount !== undefined) row.current_amount = input.currentAmount;
    if (input.targetAmount !== undefined) row.target_amount = input.targetAmount;
    if (input.deadline !== undefined) row.deadline = input.deadline;
    if (input.currency !== undefined) row.currency = input.currency;
    return row;
  },
  fromRow: (row) => ({
    id: row.id,
    businessId: row.business_id,
    type: row.type,
    name: row.name,
    currentAmount: Number(row.current_amount),
    targetAmount: Number(row.target_amount),
    deadline: row.deadline,
    currency: row.currency,
  }),
});

// Contributing to a goal both bumps its current_amount AND logs a
// transaction, so it needs a dedicated endpoint rather than a plain PATCH.
goalsRouter.post("/:id/contribute", async (req: Request, res: Response) => {
  const parsed = goalContributionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (goalError) {
    res.status(400).json({ error: goalError.message });
    return;
  }
  if (!goal) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // A contribution can be made in a currency other than the goal's own
  // target currency (e.g. paying into a USD goal with GHS cash on hand) -
  // convert to the goal's currency before adding to its balance.
  const contributionCurrency = parsed.data.currency ?? goal.currency;
  const amountInGoalCurrency =
    contributionCurrency === goal.currency
      ? parsed.data.amount
      : await convertViaBusinessCurrency(supabase, goal.business_id, parsed.data.amount, contributionCurrency, goal.currency);

  const newAmount = addMoney(Number(goal.current_amount), amountInGoalCurrency);

  const { data: updated, error: updateError } = await supabase
    .from("goals")
    .update({ current_amount: newAmount })
    .eq("id", goal.id)
    .select("*")
    .single();

  if (updateError) {
    res.status(400).json({ error: updateError.message });
    return;
  }

  const { error: txError } = await supabase.from("transactions").insert({
    business_id: goal.business_id,
    user_id: userId,
    date: new Date().toISOString().slice(0, 10),
    type: "expense",
    category: "Operations Cost",
    amount: parsed.data.amount,
    description: `Savings goal contribution: ${goal.name}`,
    payment_method: "Cash",
    currency: contributionCurrency,
  });

  if (txError) {
    console.error("[goals] failed to log contribution transaction:", txError.message);
  }

  await invalidate(`cache:goals:${userId}`, `cache:transactions:${userId}`);

  res.json({
    data: {
      id: updated.id,
      businessId: updated.business_id,
      type: updated.type,
      name: updated.name,
      currentAmount: Number(updated.current_amount),
      targetAmount: Number(updated.target_amount),
      deadline: updated.deadline,
      currency: updated.currency,
    },
  });
});
