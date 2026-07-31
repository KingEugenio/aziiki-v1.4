import { z } from "zod";
import { SUPPORTED_CURRENCY_CODES } from "../../lib/currency";

export const uuidField = z.string().uuid("Must be a valid UUID");

export const isoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date string (YYYY-MM-DD)");

/** Money amounts travel as decimal-major-unit numbers (e.g. 4500.50) over
 * the wire and are stored as NUMERIC in Postgres. All arithmetic on them
 * happens in integer minor units via src/lib/money.ts before they're ever
 * added/subtracted/multiplied - this schema only guards the shape at the
 * API boundary. */
export const moneyField = z
  .number()
  .finite()
  .nonnegative("Amount cannot be negative")
  .multipleOf(0.01, "Amount can have at most 2 decimal places")
  .max(999_999_999_999.99, "Amount is unrealistically large");

export const percentageField = z
  .number()
  .finite()
  .min(0)
  .max(100)
  .multipleOf(0.01);

/** Was previously just a 3-uppercase-letter shape check ("ZZZ" passed) -
 * now validated against the real currency list in src/lib/currency.ts,
 * which mirrors the `currencies` reference table (migration 0027). */
export const currencyField = z.enum(SUPPORTED_CURRENCY_CODES, {
  errorMap: () => ({ message: "Must be a supported ISO 4217 currency code" }),
});

export const paymentMethodField = z.enum(["Mobile Money", "Cash", "Bank Transfer"]);

/** "1 unit of the document's currency equals N units of the business's
 * currency", captured once at document creation - see the historical-
 * accuracy note in migration 0028_document_currency.sql. Defaults to 1
 * (same currency as the business, the common case) when the caller doesn't
 * supply a rate. */
export const exchangeRateField = z
  .number()
  .finite()
  .positive("Exchange rate must be greater than 0")
  .max(1_000_000, "Exchange rate is unrealistically large");

export const nonEmptyString = z.string().trim().min(1, "This field is required");
