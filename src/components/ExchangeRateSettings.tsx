import React, { useEffect, useState } from "react";
import { Plus, Trash as Trash2, CurrencyDollar as CurrencyIcon } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";
import { LoadingSwap } from "./LoadingSwap";
import { SkeletonTable } from "./Skeleton";
import { SUPPORTED_CURRENCY_CODES } from "../lib/currency";

interface ExchangeRate {
  id: string;
  businessId: string;
  currency: string;
  rateToBusinessCurrency: number;
  source: "manual" | "live";
  updatedAt: string;
}

interface ExchangeRateSettingsProps {
  businessId: string;
  businessCurrency: string;
}

/**
 * Self-fetching, following the same pattern as TeamManager/
 * PurchaseOrderManager: calls /api/exchange-rates directly. Rates here are
 * manual-only for now (source is always "manual") - a live-rate provider was
 * explicitly deferred in the approved currency architecture, since a wrong
 * automatic rate on a financial document is worse than requiring the
 * business to type one in. Saved rates are what auto-fill the exchange-rate
 * field when building a new invoice/receipt/quotation/PO in a foreign
 * currency (see InvoiceReceiptBuilder / PurchaseOrderManager).
 */
export default function ExchangeRateSettings({ businessId, businessCurrency }: ExchangeRateSettingsProps) {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [currency, setCurrency] = useState<string>(SUPPORTED_CURRENCY_CODES.find((c) => c !== businessCurrency) || "USD");
  const [rate, setRate] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.exchangeRates
      .list(businessId)
      .then((data) => {
        if (!cancelled) setRates(data as ExchangeRate[]);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load exchange rates.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currency === businessCurrency) {
      setError(`This business's own currency (${businessCurrency}) is always rate 1 - pick a different currency.`);
      return;
    }
    if (rate <= 0) {
      setError("Rate must be greater than 0.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const saved = await api.exchangeRates.upsert({ businessId, currency, rateToBusinessCurrency: rate });
      setRates((prev) => {
        const withoutExisting = prev.filter((r) => r.currency !== (saved as ExchangeRate).currency);
        return [...withoutExisting, saved as ExchangeRate].sort((a, b) => a.currency.localeCompare(b.currency));
      });
      setRate(1);
      setIsAdding(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this exchange rate.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    setError(null);
    try {
      await api.exchangeRates.remove(id);
      setRates((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove this exchange rate.");
    }
  };

  return (
    <div id="exchange-rate-settings-root" className="space-y-4 text-slate-800 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CurrencyIcon className="w-4 h-4 text-emerald-600" />
            Exchange Rates
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Saved rates auto-fill when you create a document in a foreign currency. Business currency: {businessCurrency}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding((v) => !v)}
          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-750 flex items-center gap-1 cursor-pointer bg-slate-50 border border-slate-200 hover:border-slate-300 px-2 py-1 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" /> Add Rate
        </button>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs">{error}</div>}

      {isAdding && (
        <form onSubmit={handleSave} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="fx-currency" className="text-[9px] font-mono font-bold text-slate-450 block">Currency</label>
              <select
                id="fx-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none"
              >
                {SUPPORTED_CURRENCY_CODES.filter((c) => c !== businessCurrency).map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fx-rate" className="text-[9px] font-mono font-bold text-slate-450 block">
                1 {currency} = ? {businessCurrency}
              </label>
              <input
                id="fx-rate"
                type="number"
                min={0}
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value) || 0)}
                className="w-full bg-white text-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 mt-1 outline-none font-mono"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-2.5 rounded-lg text-white font-semibold uppercase tracking-wider text-[10px] cursor-pointer"
          >
            {isSaving ? "Saving..." : "Save Rate"}
          </button>
        </form>
      )}

      <LoadingSwap isLoading={isLoading} skeleton={<SkeletonTable rows={3} cols={2} />}>
        <div className="space-y-2">
          {rates.length === 0 ? (
            <div className="text-center py-12 text-slate-400 italic text-xs">
              No saved rates yet. Documents in a foreign currency will default to rate 1 until you add one here.
            </div>
          ) : (
            rates.map((r) => (
              <div key={r.id} className="border border-slate-200 rounded-xl p-3.5 bg-white flex items-center justify-between text-xs gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">1 {r.currency} = {r.rateToBusinessCurrency} {businessCurrency}</p>
                  <p className="text-slate-400 text-[9px] mt-0.5">
                    Updated {new Date(r.updatedAt).toLocaleDateString()} · {r.source}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(r.id)}
                  aria-label={`Remove exchange rate for ${r.currency}`}
                  className="w-7 h-7 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-rose-100 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </LoadingSwap>
    </div>
  );
}
