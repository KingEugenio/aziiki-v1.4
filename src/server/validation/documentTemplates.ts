import { z } from "zod";
import { nonEmptyString, uuidField } from "./common";

export const documentTypeField = z.enum([
  "invoice", "receipt", "quotation", "estimate", "purchase_order",
  "delivery_note", "credit_note", "debit_note", "contract",
  "proforma_invoice", "expense_receipt", "payment_voucher",
  "customer_statement", "supplier_statement",
]);

export const templateCategoryField = z.enum([
  "Corporate", "Minimal", "Luxury", "Modern", "Creative", "African Inspired",
  "Fashion", "Photography", "Construction", "Restaurant", "Retail", "Medical",
  "Legal", "Technology", "Education", "Wholesale", "Manufacturing",
  "Real Estate", "Hospitality", "Custom",
]);

export const documentTemplateCreateSchema = z.object({
  businessId: uuidField,
  name: nonEmptyString.max(200),
  description: z.string().trim().max(1000).optional(),
  documentType: documentTypeField,
  category: templateCategoryField,
  layoutConfig: z.record(z.string(), z.unknown()).default({}),
  thumbnailUrl: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  folder: z.string().trim().max(120).optional(),
  sourceFormat: z.enum(["native", "pdf", "image", "svg", "html", "docx"]).default("native"),
});

export const documentTemplateUpdateSchema = z.object({
  name: nonEmptyString.max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  category: templateCategoryField.optional(),
  layoutConfig: z.record(z.string(), z.unknown()).optional(),
  thumbnailUrl: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  folder: z.string().trim().max(120).optional(),
  isFavorite: z.boolean().optional(),
});
