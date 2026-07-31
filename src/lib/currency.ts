/**
 * Client+server shared currency reference data. Mirrors the seed rows in
 * supabase/migrations/0027_currencies.sql - kept as a versioned TS constant
 * rather than fetched over the network from the `currencies` table, since
 * src/lib/money.ts uses this in hot-path arithmetic that must not depend on
 * an async DB round-trip. Add a currency here AND in the migration seed
 * when supporting a new one; neither alone is sufficient.
 */
export const SUPPORTED_CURRENCY_CODES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF", "JPY", "CNY", "INR", "KRW", "SGD", "HKD", "AED", "SAR", "QAR",
  "GHS", "NGN", "KES", "ZAR", "EGP", "MAD", "TZS", "UGX", "XOF", "XAF", "GNF", "RWF", "ETB", "ZMW", "MWK", "BWP",
  "NAD", "MZN", "AOA", "SDG", "DZD", "TND", "LYD", "SOS", "SLL", "LRD", "GMD", "CVE", "MUR", "SCR", "MGA", "BIF",
  "DJF", "KMF", "STN", "SZL", "LSL",
  "ILS", "TRY", "PKR", "BDT", "LKR", "NPR", "THB", "VND", "IDR", "MYR", "PHP", "BHD", "KWD", "OMR", "JOD", "LBP", "IQD",
  "MXN", "BRL", "ARS", "CLP", "COP", "PEN", "UYU", "BOB", "PYG", "JMD", "TTD", "BBD", "BSD", "DOP", "HTG", "GTQ",
  "HNL", "NIO", "CRC", "PAB",
  "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RON", "BGN", "ISK", "RUB", "UAH",
  "FJD", "PGK", "WST", "TOP", "VUV", "XPF",
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number];

/**
 * Currencies whose minor unit isn't the usual 2 decimal places - the exact
 * set money.ts previously got wrong by hardcoding a flat 100x conversion
 * factor for every currency. Anything not listed here defaults to 2.
 */
const MINOR_UNIT_EXCEPTIONS: Partial<Record<SupportedCurrencyCode, number>> = {
  JPY: 0, KRW: 0, UGX: 0, XOF: 0, XAF: 0, GNF: 0, RWF: 0, BIF: 0, DJF: 0, KMF: 0,
  CLP: 0, PYG: 0, VND: 0, ISK: 0, VUV: 0, XPF: 0,
  BHD: 3, KWD: 3, OMR: 3, TND: 3, LYD: 3, JOD: 3, IQD: 3,
};

/** Decimal places for a currency code. Defaults to 2 for unlisted/unknown codes. */
export function getMinorUnitDigits(currencyCode?: string): number {
  if (!currencyCode) return 2;
  const code = currencyCode.toUpperCase() as SupportedCurrencyCode;
  return MINOR_UNIT_EXCEPTIONS[code] ?? 2;
}

/**
 * Real, locale-correct currency symbol via Intl - replaces the old
 * hand-rolled 3-currency switch statement (App.tsx) that silently defaulted
 * every currency except GHS/NGN/KES to a plain "$", even for USD/EUR/GBP
 * which the app claimed to support. Works for any ISO 4217 code the
 * runtime's Intl data recognizes, not just the ones seeded in our own
 * `currencies` table.
 */
export function getCurrencySymbol(currencyCode: string, locale: string = "en-US"): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).formatToParts(0);
    const currencyPart = parts.find((part) => part.type === "currency");
    return currencyPart?.value ?? currencyCode;
  } catch {
    // Intl throws on a currency code it doesn't recognize at all - fall
    // back to the raw code rather than crashing or showing nothing.
    return currencyCode;
  }
}

/**
 * Full, locale-correct money formatting via Intl.NumberFormat - handles
 * symbol placement, thousands/decimal separators, and per-currency decimal
 * places (JPY's "¥100,000" vs EUR's "€1.250,50") entirely correctly with no
 * bespoke per-currency formatting rules of our own.
 */
export function formatMoneyIntl(majorAmount: number, currencyCode: string, locale: string = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(majorAmount);
  } catch {
    return `${currencyCode} ${majorAmount.toFixed(getMinorUnitDigits(currencyCode))}`;
  }
}
