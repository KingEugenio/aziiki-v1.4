import { z } from "zod";
import { moneyField, nonEmptyString, currencyField, percentageField, uuidField } from "./common";

export const businessCreateSchema = z.object({
  id: uuidField.optional(),
  name: nonEmptyString.max(200),
  industry: z.string().trim().max(200).optional(),
  logo: z.string().trim().max(20).optional(),
  primaryColor: z.string().trim().max(20).optional(),
  taxRate: percentageField.default(0),
  currency: currencyField.default("GHS"),
  description: z.string().trim().max(2000).optional(),
  businessType: z.enum(["Sole Proprietor", "Partnership", "Company"]).optional(),
  allowFinancialApprovals: z.boolean().optional(),
  isPersonal: z.boolean().optional(),
  locked: z.boolean().optional(),
  // The business's home location - used to detect when the current user is
  // traveling (different timezone than "home") so the app can offer a
  // session-only display-currency switch. Auto-detected and prefilled by
  // the frontend on first load, always editable afterward.
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  timezone: z.string().trim().max(100).optional(),
});

export const businessUpdateSchema = businessCreateSchema.partial();

export const businessPartnerSchema = z.object({
  businessId: uuidField,
  name: nonEmptyString.max(200),
  ownershipPercentage: percentageField,
  capitalContribution: moneyField,
  withdrawals: moneyField.default(0),
});

export const businessShareholderSchema = z.object({
  businessId: uuidField,
  name: nonEmptyString.max(200),
  sharesCount: z.number().int().nonnegative(),
  equityValue: moneyField,
  capitalContribution: moneyField,
});

export const businessRoleSchema = z.object({
  businessId: uuidField,
  name: nonEmptyString.max(200),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["Owner", "Admin", "Accountant", "Staff"]),
});

export const personalAccountSchema = z.object({
  businessId: uuidField,
  name: nonEmptyString.max(200),
  type: z.enum([
    "MTN Mobile Money",
    "Telecel Cash",
    "AirtelTigo Money",
    "Bank Account",
    "Cash Wallet",
    "Savings Account",
  ]),
  initialBalance: moneyField.default(0),
  balance: moneyField.default(0),
});

export const personalBudgetSchema = z.object({
  businessId: uuidField,
  category: nonEmptyString.max(200),
  limitAmount: moneyField,
});
