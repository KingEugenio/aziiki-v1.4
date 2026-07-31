import { Router, type Request, type Response } from "express";
import { brandKitUpsertSchema } from "../validation/brandKit";
import { cached, invalidate } from "../redis";

const CACHE_TTL_SECONDS = 45;

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    logoUrl: row.logo_url ?? undefined,
    darkLogoUrl: row.dark_logo_url ?? undefined,
    lightLogoUrl: row.light_logo_url ?? undefined,
    watermarkUrl: row.watermark_url ?? undefined,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    fontFamily: row.font_family,
    registrationNumber: row.registration_number ?? undefined,
    taxId: row.tax_id ?? undefined,
    vatNumber: row.vat_number ?? undefined,
    address: row.address ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    website: row.website ?? undefined,
    socialLinks: row.social_links ?? {},
    defaultPaymentMethods: row.default_payment_methods ?? [],
    invoiceFooterText: row.invoice_footer_text ?? undefined,
    receiptFooterText: row.receipt_footer_text ?? undefined,
    legalDisclaimer: row.legal_disclaimer ?? undefined,
  };
}

export const brandKitsRouter = Router();

// One brand kit per business - GET returns it (or null if not created yet)
// rather than a list, since there's exactly zero-or-one per business.
brandKitsRouter.get("/", async (req: Request, res: Response) => {
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  if (!businessId) {
    res.status(400).json({ error: "businessId query parameter is required" });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const cacheKey = `cache:brand_kit:${userId}:${businessId}`;

  const row = await cached(cacheKey, CACHE_TTL_SECONDS, async () => {
    const { data, error } = await supabase.from("brand_kits").select("*").eq("business_id", businessId).maybeSingle();
    if (error) throw error;
    return data;
  });

  res.json({ data: row ? fromRow(row) : null });
});

// Upsert: creates the brand kit on first save, updates it on every save
// after that - the frontend never needs to know which case it is.
brandKitsRouter.put("/", async (req: Request, res: Response) => {
  const parsed = brandKitUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  const row: Record<string, unknown> = {
    user_id: userId,
    business_id: input.businessId,
  };
  if (input.logoUrl !== undefined) row.logo_url = input.logoUrl;
  if (input.darkLogoUrl !== undefined) row.dark_logo_url = input.darkLogoUrl;
  if (input.lightLogoUrl !== undefined) row.light_logo_url = input.lightLogoUrl;
  if (input.watermarkUrl !== undefined) row.watermark_url = input.watermarkUrl;
  if (input.primaryColor !== undefined) row.primary_color = input.primaryColor;
  if (input.secondaryColor !== undefined) row.secondary_color = input.secondaryColor;
  if (input.accentColor !== undefined) row.accent_color = input.accentColor;
  if (input.fontFamily !== undefined) row.font_family = input.fontFamily;
  if (input.registrationNumber !== undefined) row.registration_number = input.registrationNumber;
  if (input.taxId !== undefined) row.tax_id = input.taxId;
  if (input.vatNumber !== undefined) row.vat_number = input.vatNumber;
  if (input.address !== undefined) row.address = input.address;
  if (input.phone !== undefined) row.phone = input.phone;
  if (input.email !== undefined) row.email = input.email || null;
  if (input.website !== undefined) row.website = input.website;
  if (input.socialLinks !== undefined) row.social_links = input.socialLinks;
  if (input.defaultPaymentMethods !== undefined) row.default_payment_methods = input.defaultPaymentMethods;
  if (input.invoiceFooterText !== undefined) row.invoice_footer_text = input.invoiceFooterText;
  if (input.receiptFooterText !== undefined) row.receipt_footer_text = input.receiptFooterText;
  if (input.legalDisclaimer !== undefined) row.legal_disclaimer = input.legalDisclaimer;

  const { data, error } = await supabase
    .from("brand_kits")
    .upsert(row, { onConflict: "business_id" })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  await invalidate(`cache:brand_kit:${userId}:${input.businessId}`);
  res.json({ data: fromRow(data) });
});
