import type { Request, Response } from "express";
import { Router } from "express";
import { exchangeRateUpsertSchema } from "../validation/exchangeRates";

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    currency: row.currency,
    rateToBusinessCurrency: Number(row.rate_to_business_currency),
    source: row.source,
    updatedAt: row.updated_at,
  };
}

export const exchangeRatesRouter = Router();

exchangeRatesRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  if (!businessId) {
    res.status(400).json({ error: "businessId is required" });
    return;
  }

  const { data, error } = await supabase
    .from("business_exchange_rates")
    .select("*")
    .eq("business_id", businessId)
    .order("currency", { ascending: true });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: (data ?? []).map(fromRow) });
});

// One saved rate per (business, currency) - saving again for a currency
// that already has a rate updates it in place rather than erroring, since
// "set today's rate" is the whole point of this endpoint.
exchangeRatesRouter.put("/", async (req: Request, res: Response) => {
  const parsed = exchangeRateUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const { businessId, currency, rateToBusinessCurrency } = parsed.data;

  const { data, error } = await supabase
    .from("business_exchange_rates")
    .upsert(
      {
        user_id: userId,
        business_id: businessId,
        currency,
        rate_to_business_currency: rateToBusinessCurrency,
        source: "manual",
      },
      { onConflict: "business_id,currency" }
    )
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(200).json({ data: fromRow(data) });
});

exchangeRatesRouter.delete("/:id", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("business_exchange_rates")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.status(204).send();
});
