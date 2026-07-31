import { z } from "zod";
import { uuidField, currencyField, exchangeRateField } from "./common";

export const exchangeRateUpsertSchema = z.object({
  businessId: uuidField,
  currency: currencyField,
  rateToBusinessCurrency: exchangeRateField,
});
