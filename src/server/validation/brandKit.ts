import { z } from "zod";
import { nonEmptyString, uuidField } from "./common";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color like #102A43");

export const brandKitUpsertSchema = z.object({
  businessId: uuidField,
  logoUrl: z.string().trim().max(4000).optional(),
  darkLogoUrl: z.string().trim().max(4000).optional(),
  lightLogoUrl: z.string().trim().max(4000).optional(),
  watermarkUrl: z.string().trim().max(4000).optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  accentColor: hexColor.optional(),
  fontFamily: nonEmptyString.max(80).optional(),
  registrationNumber: z.string().trim().max(120).optional(),
  taxId: z.string().trim().max(120).optional(),
  vatNumber: z.string().trim().max(120).optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(60).optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  website: z.string().trim().max(300).optional(),
  socialLinks: z.record(z.string(), z.string().trim().max(300)).optional(),
  defaultPaymentMethods: z.array(z.string().trim().max(60)).optional(),
  invoiceFooterText: z.string().trim().max(2000).optional(),
  receiptFooterText: z.string().trim().max(2000).optional(),
  legalDisclaimer: z.string().trim().max(2000).optional(),
});
