import { z } from "zod";
import { currencyField, moneyField, uuidField } from "./common";

export const paystackInitializeSchema = z.object({
  businessId: uuidField,
  invoiceId: uuidField.optional(),
  customerId: uuidField.optional(),
  // Required because Paystack requires an email per transaction; falls back
  // to the invoice's customer email on the server if this is omitted but an
  // invoiceId is present.
  email: z.string().trim().toLowerCase().email().optional(),
  amount: moneyField.positive("Amount must be greater than zero"),
  currency: currencyField.default("GHS"),
});
