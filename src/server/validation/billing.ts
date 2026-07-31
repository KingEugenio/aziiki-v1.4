import { z } from "zod";
import { moneyField, nonEmptyString, isoDateField, paymentMethodField, percentageField, uuidField, currencyField, exchangeRateField } from "./common";

export const customerSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField,
  name: nonEmptyString.max(200),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(100).optional(),
  avatarColor: z.string().trim().max(60).optional(),
  // Auto-selected when creating a new document for this customer; never
  // required since most customers transact in the business's own currency.
  preferredCurrency: currencyField.optional(),
});

export const transactionSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField,
  date: isoDateField,
  type: z.enum(["income", "expense"]),
  category: nonEmptyString.max(120),
  amount: moneyField,
  description: z.string().trim().max(2000).optional(),
  paymentMethod: paymentMethodField,
  customerId: uuidField.optional(),
  proofUri: z.string().trim().max(2000).optional(),
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.default(1),
});

const invoiceItemSchema = z.object({
  description: nonEmptyString.max(500),
  quantity: z.number().finite().positive().multipleOf(0.01),
  rate: moneyField,
});

export const invoiceCreateSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField,
  // Optional: when omitted, the server assigns the next number atomically
  // via next_document_number(). Only pass this explicitly when preserving a
  // historical number (e.g. migrating/importing existing records).
  invoiceNumber: nonEmptyString.max(60).optional(),
  customerId: uuidField.optional(),
  customClientName: z.string().trim().max(200).optional(),
  date: isoDateField,
  dueDate: isoDateField,
  items: z.array(invoiceItemSchema).min(1, "An invoice needs at least one line item"),
  discount: percentageField.default(0),
  taxRate: percentageField.default(0),
  status: z.enum(["Draft", "Sent", "Paid", "Overdue"]).default("Draft"),
  partialPaidAmount: moneyField.default(0),
  logoUrl: z.string().trim().max(2000).optional(),
  // Omitted = the business's own currency at rate 1 (the common case); the
  // route fills this in since the business's currency isn't known to Zod.
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.default(1),
}).refine((data) => Boolean(data.customerId) || Boolean(data.customClientName), {
  message: "Either customerId or customClientName is required",
  path: ["customerId"],
});

export const invoiceUpdateSchema = z.object({
  invoiceNumber: nonEmptyString.max(60).optional(),
  customerId: uuidField.optional(),
  customClientName: z.string().trim().max(200).optional(),
  date: isoDateField.optional(),
  dueDate: isoDateField.optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  discount: percentageField.optional(),
  taxRate: percentageField.optional(),
  status: z.enum(["Draft", "Sent", "Paid", "Overdue"]).optional(),
  partialPaidAmount: moneyField.optional(),
  logoUrl: z.string().trim().max(2000).optional(),
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.optional(),
});

export const receiptSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField,
  customerId: uuidField.optional(),
  customClientName: z.string().trim().max(200).optional(),
  invoiceId: uuidField.optional(),
  receiptNumber: nonEmptyString.max(60).optional(),
  date: isoDateField,
  description: z.string().trim().max(2000).optional(),
  amountPaid: moneyField,
  paymentMethod: paymentMethodField,
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.default(1),
}).refine((data) => Boolean(data.customerId) || Boolean(data.customClientName), {
  message: "Either customerId or customClientName is required",
  path: ["customerId"],
});

export const receiptUpdateSchema = z.object({
  customerId: uuidField.optional(),
  customClientName: z.string().trim().max(200).optional(),
  invoiceId: uuidField.optional(),
  receiptNumber: nonEmptyString.max(60).optional(),
  date: isoDateField.optional(),
  description: z.string().trim().max(2000).optional(),
  amountPaid: moneyField.optional(),
  paymentMethod: paymentMethodField.optional(),
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.optional(),
});

export const quotationCreateSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField,
  customerId: uuidField.optional(),
  customClientName: z.string().trim().max(200).optional(),
  quoteNumber: nonEmptyString.max(60).optional(),
  date: isoDateField,
  validUntil: isoDateField,
  items: z.array(invoiceItemSchema).min(1, "A quotation needs at least one line item"),
  discount: percentageField.default(0),
  status: z.enum(["Draft", "Sent", "Converted", "Accepted"]).default("Draft"),
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.default(1),
}).refine((data) => Boolean(data.customerId) || Boolean(data.customClientName), {
  message: "Either customerId or customClientName is required",
  path: ["customerId"],
});

export const quotationUpdateSchema = z.object({
  customerId: uuidField.optional(),
  customClientName: z.string().trim().max(200).optional(),
  quoteNumber: nonEmptyString.max(60).optional(),
  date: isoDateField.optional(),
  validUntil: isoDateField.optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  discount: percentageField.optional(),
  status: z.enum(["Draft", "Sent", "Converted", "Accepted"]).optional(),
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.optional(),
});

export const purchaseOrderCreateSchema = z.object({
  id: uuidField.optional(),
  businessId: uuidField,
  supplierName: nonEmptyString.max(200),
  supplierContact: z.string().trim().max(200).optional(),
  poNumber: nonEmptyString.max(60).optional(),
  date: isoDateField,
  expectedDeliveryDate: isoDateField.optional(),
  items: z.array(invoiceItemSchema).min(1, "A purchase order needs at least one line item"),
  discount: percentageField.default(0),
  status: z.enum(["Draft", "Sent", "Confirmed", "Received", "Cancelled"]).default("Draft"),
  notes: z.string().trim().max(2000).optional(),
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.default(1),
});

export const purchaseOrderUpdateSchema = z.object({
  supplierName: nonEmptyString.max(200).optional(),
  supplierContact: z.string().trim().max(200).optional(),
  poNumber: nonEmptyString.max(60).optional(),
  date: isoDateField.optional(),
  expectedDeliveryDate: isoDateField.optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  discount: percentageField.optional(),
  status: z.enum(["Draft", "Sent", "Confirmed", "Received", "Cancelled"]).optional(),
  notes: z.string().trim().max(2000).optional(),
  currency: currencyField.optional(),
  exchangeRateToBusinessCurrency: exchangeRateField.optional(),
});
