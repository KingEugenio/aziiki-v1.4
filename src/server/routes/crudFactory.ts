import { Router, type Request, type Response } from "express";
import type { ZodSchema } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cached, invalidate } from "../redis";

const LIST_CACHE_TTL_SECONDS = 45; // within the requested 30-60s window

export interface CrudResourceConfig<CreateInput, UpdateInput, Row, ApiShape> {
  /** Postgres table name (public schema). */
  table: string;
  /** Short, unique cache-key segment for this resource. */
  cacheKeyPrefix: string;
  createSchema: ZodSchema<CreateInput>;
  updateSchema: ZodSchema<UpdateInput>;
  /** Maps validated, camelCase API input -> a snake_case DB row for insert.
   * Receives the request's RLS-scoped Supabase client so it can look up
   * defaults (e.g. a business's currency) that aren't known to Zod. */
  toInsertRow: (userId: string, input: CreateInput, supabase: SupabaseClient) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Maps validated, camelCase API input -> a snake_case DB row for update (partial). */
  toUpdateRow: (input: UpdateInput) => Record<string, unknown>;
  /** Maps a raw snake_case DB row -> the camelCase shape the frontend expects. */
  fromRow: (row: Row) => ApiShape;
  /** Optional: restrict listing/filtering to rows for one business via ?businessId=. */
  supportsBusinessFilter?: boolean;
}

/**
 * Builds a standard REST CRUD router (GET list / POST / PATCH / DELETE) for
 * one Supabase table. Every query runs through req.supabase, which is
 * scoped to the caller's own access token - Postgres RLS is what actually
 * enforces the boundary, for every operation including PATCH/DELETE. Those
 * two used to also add `.eq('user_id', userId)` as "defense in depth", but
 * that stopped being harmless once RLS started allowing business team
 * members (see migration 0026) to update/delete rows they didn't personally
 * create - the app-level filter would silently 404 exactly the writes RLS is
 * now supposed to permit. RLS is the single source of truth here; the app
 * layer doesn't re-implement it.
 */
export function createCrudRouter<CreateInput, UpdateInput, Row, ApiShape>(
  config: CrudResourceConfig<CreateInput, UpdateInput, Row, ApiShape>
): Router {
  const router = Router();
  const { table, cacheKeyPrefix, createSchema, updateSchema, toInsertRow, toUpdateRow, fromRow } = config;

  const listCacheKey = (userId: string) => `cache:${cacheKeyPrefix}:${userId}`;

  router.get("/", async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const supabase = req.supabase!;

    const allRows = await cached(listCacheKey(userId), LIST_CACHE_TTL_SECONDS, async () => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Row[];
    });

    let rows = allRows;
    if (config.supportsBusinessFilter && typeof req.query.businessId === "string") {
      const businessId = req.query.businessId;
      rows = allRows.filter((row) => (row as unknown as { business_id?: string }).business_id === businessId);
    }

    res.json({ data: rows.map(fromRow) });
  });

  router.post("/", async (req: Request, res: Response) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
      return;
    }

    const userId = req.user!.id;
    const supabase = req.supabase!;
    const insertRow = { ...(await toInsertRow(userId, parsed.data, supabase)), user_id: userId };

    const { data, error } = await supabase.from(table).insert(insertRow).select("*").single();
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    await invalidate(listCacheKey(userId));
    res.status(201).json({ data: fromRow(data as Row) });
  });

  router.patch("/:id", async (req: Request, res: Response) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
      return;
    }

    const userId = req.user!.id;
    const supabase = req.supabase!;
    const updateRow = toUpdateRow(parsed.data);

    if (Object.keys(updateRow).length === 0) {
      res.status(400).json({ error: "No updatable fields provided" });
      return;
    }

    const { data, error } = await supabase
      .from(table)
      .update(updateRow)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await invalidate(listCacheKey(userId));
    res.json({ data: fromRow(data as Row) });
  });

  router.delete("/:id", async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const supabase = req.supabase!;

    const { data, error } = await supabase
      .from(table)
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

    await invalidate(listCacheKey(userId));
    res.status(204).send();
  });

  return router;
}

/** Looks up a business's own currency, for defaulting a document/record's
 * currency when the caller doesn't specify one. Falls back to "GHS" (the
 * app's original default) if the business can't be found, e.g. a debt
 * with no businessId at all. */
export async function resolveBusinessCurrency(
  supabase: SupabaseClient,
  businessId: string | undefined
): Promise<string> {
  if (!businessId) return "GHS";
  const { data } = await supabase.from("businesses").select("currency").eq("id", businessId).maybeSingle();
  return (data as { currency?: string } | null)?.currency ?? "GHS";
}

/** Converts an amount from one currency to another for a given business,
 * pivoting through the business's own currency since that's the only rate
 * relationship business_exchange_rates stores ("1 unit of X = N units of
 * the business currency"). Falls back to a 1:1 rate for any leg with no
 * saved rate - the same "no rate yet" fallback used everywhere else in the
 * currency system, rather than blocking the action entirely. */
export async function convertViaBusinessCurrency(
  supabase: SupabaseClient,
  businessId: string,
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return amount;

  const businessCurrency = await resolveBusinessCurrency(supabase, businessId);
  const { data: rates } = await supabase
    .from("business_exchange_rates")
    .select("currency, rate_to_business_currency")
    .eq("business_id", businessId)
    .in("currency", [fromCurrency, toCurrency]);

  const rateMap: Record<string, number> = {};
  for (const r of (rates ?? []) as { currency: string; rate_to_business_currency: number }[]) {
    rateMap[r.currency] = Number(r.rate_to_business_currency);
  }

  const fromRate = fromCurrency === businessCurrency ? 1 : rateMap[fromCurrency] ?? 1;
  const toRate = toCurrency === businessCurrency ? 1 : rateMap[toCurrency] ?? 1;

  const amountInBusinessCurrency = amount * fromRate;
  return amountInBusinessCurrency / toRate;
}
