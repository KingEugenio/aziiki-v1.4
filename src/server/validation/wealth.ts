import { z } from "zod";
import { moneyField, nonEmptyString, isoDateField, uuidField, currencyField } from "./common";

export const investmentSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField.optional(),
  type: z.enum([
    "Treasury Bill",
    "Mutual Fund",
    "Fixed Deposit",
    "Stock",
    "Bond",
    "Real Estate",
    "Business Investment",
    "Savings Account",
    "SACCO/Cooperative",
  ]),
  name: nonEmptyString.max(200),
  institution: z.string().trim().max(200).optional(),
  value: moneyField,
  amountInvested: moneyField,
  maturityDate: isoDateField.optional(),
  expectedReturnRate: z.number().finite().min(-100).max(1000),
  dateAcquired: isoDateField,
  notes: z.string().trim().max(2000).optional(),
});

export const assetSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField.optional(),
  name: nonEmptyString.max(200),
  category: z.enum(["Machinery", "Equipment", "Vehicle", "Real Estate", "Computer/IT", "Other"]),
  purchaseDate: isoDateField,
  purchasePrice: moneyField,
  currentValue: moneyField,
  depreciationMethod: z.enum(["Straight Line", "Double Declining", "None"]).optional(),
  usefulLifeYears: z.number().int().positive().optional(),
  salvageValue: moneyField.optional(),
  maintenanceLastDate: isoDateField.optional(),
  maintenanceNextDate: isoDateField.optional(),
  maintenanceStatus: z.enum(["Good", "Needs Service", "Overdue"]).optional(),
  maintenanceNotes: z.string().trim().max(2000).optional(),
  documentsNotes: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const goalSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField,
  type: z.enum(["Revenue", "Savings", "Equipment", "Expansion"]),
  name: nonEmptyString.max(200),
  currentAmount: moneyField.default(0),
  targetAmount: moneyField,
  deadline: isoDateField,
  // The goal's fixed target currency. Omitted = the business's own
  // currency at the time the goal is created.
  currency: currencyField.optional(),
});

export const goalContributionSchema = z.object({
  amount: moneyField,
  // The currency `amount` is denominated in. Omitted = the goal's own
  // currency (no conversion needed). When it differs, the server converts
  // using the business's saved exchange rates (pivoting through the
  // business's own currency) before adding to the goal's current_amount.
  currency: currencyField.optional(),
});

export const debtSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField.optional(),
  creditor: nonEmptyString.max(200),
  amount: moneyField,
  interestRate: z.number().finite().min(0).max(1000).default(0),
  dueDate: isoDateField,
  type: z.enum(["Loan", "Supplier Credit", "Overdraft"]),
  // The debt's fixed denomination currency. Omitted = the business's own
  // currency, or GHS if the debt has no business (businessId is optional).
  currency: currencyField.optional(),
});

export const debtRepaymentSchema = z.object({
  amount: moneyField,
});
