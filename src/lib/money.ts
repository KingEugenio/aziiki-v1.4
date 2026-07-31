import { getMinorUnitDigits } from "./currency";

/**
 * All money math in this app happens in integer minor units (pesewas,
 * kobo, cents - whichever the active currency's smallest unit is) so that
 * floating point rounding drift never creeps into a financial calculation.
 * Postgres stores the major-unit decimal (NUMERIC(14,2)); these helpers are
 * the only place a major-unit number is converted to/from that integer form.
 *
 * toMinorUnits/fromMinorUnits/multiplyMoney/applyPercentage now take an
 * OPTIONAL trailing currencyCode. Omitting it preserves the exact old
 * behavior (a flat 2 decimal places) for every existing call site - none of
 * them need to change today. Passing a currency code (JPY, BHD, etc.) gets
 * the correct decimal places for that currency instead of silently
 * assuming 2, which is what this module did unconditionally before.
 *
 * addMoney/subtractMoney/calculateInvoiceTotals deliberately do NOT take a
 * currency yet - no document in this schema has its own currency field to
 * pass in until that's built (multi-currency documents, a separate piece of
 * work); threading a currency through a variadic function like addMoney
 * ahead of having real data for it would add risk for no present benefit.
 */

/** Major-unit decimal (e.g. 4500.5) -> integer minor units (e.g. 450050). */
export function toMinorUnits(majorAmount: number, currencyCode?: string): number {
  if (!Number.isFinite(majorAmount)) {
    throw new Error(`toMinorUnits: not a finite number (${majorAmount})`);
  }
  const factor = 10 ** getMinorUnitDigits(currencyCode);
  return Math.round(majorAmount * factor);
}

/** Integer minor units (e.g. 450050) -> major-unit decimal (e.g. 4500.5). */
export function fromMinorUnits(minorAmount: number, currencyCode?: string): number {
  const factor = 10 ** getMinorUnitDigits(currencyCode);
  return Math.round(minorAmount) / factor;
}

export function addMoney(...majorAmounts: number[]): number {
  const totalMinor = majorAmounts.reduce((sum, amount) => sum + toMinorUnits(amount), 0);
  return fromMinorUnits(totalMinor);
}

export function subtractMoney(a: number, b: number): number {
  return fromMinorUnits(toMinorUnits(a) - toMinorUnits(b));
}

/** Multiply a money amount by a plain (non-money) factor, e.g. quantity. */
export function multiplyMoney(majorAmount: number, factor: number, currencyCode?: string): number {
  return fromMinorUnits(Math.round(toMinorUnits(majorAmount, currencyCode) * factor), currencyCode);
}

/** Apply a percentage (0-100, up to 2 decimal places) to a money amount. */
export function applyPercentage(majorAmount: number, percent: number, currencyCode?: string): number {
  const minor = toMinorUnits(majorAmount, currencyCode);
  // Scale percent by 100 first (basis points) to keep this an integer
  // operation throughout, then divide back down.
  const percentBasisPoints = Math.round(percent * 100);
  return fromMinorUnits(Math.round((minor * percentBasisPoints) / 10_000), currencyCode);
}

export interface InvoiceLineItem {
  quantity: number;
  rate: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

/**
 * The one authoritative place invoice/quotation math happens, used by both
 * the API (server/routes/invoices.ts, quotations.ts) and the frontend
 * (InvoiceReceiptBuilder.tsx) so the two can never drift from each other.
 */
export function calculateInvoiceTotals(
  items: InvoiceLineItem[],
  discountPercent: number,
  taxRatePercent: number,
  shipping: number = 0
): InvoiceTotals {
  const subtotalMinor = items.reduce(
    (sum, item) => sum + Math.round(toMinorUnits(item.rate) * item.quantity),
    0
  );
  const subtotal = fromMinorUnits(subtotalMinor);
  const discountAmount = applyPercentage(subtotal, discountPercent);
  const taxAmount = applyPercentage(subtotal, taxRatePercent);
  const total = addMoney(subtotal, -discountAmount, taxAmount, shipping);
  return { subtotal, discountAmount, taxAmount, total };
}

export function formatMoney(majorAmount: number, currencySymbol: string): string {
  return `${currencySymbol}${majorAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
