import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { documentTypeField } from "../validation/documentTemplates";

const peekQuerySchema = z.object({
  businessId: z.string().uuid(),
  documentType: documentTypeField,
  defaultPrefix: z.string().trim().max(10).optional(),
});

export const documentNumberingRouter = Router();

// Read-only preview of what the NEXT number would look like, without
// reserving it - lets the builder UI show "INV-0042" while the user is
// still filling out the form. The real, atomic reservation only happens
// when the document is actually created (see next_document_number() calls
// in invoices.ts/receipts.ts/quotations.ts).
documentNumberingRouter.get("/peek", async (req: Request, res: Response) => {
  const parsed = peekQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { businessId, documentType, defaultPrefix } = parsed.data;

  const { data, error } = await supabase
    .from("document_numbering_sequences")
    .select("next_number, prefix, padding")
    .eq("business_id", businessId)
    .eq("document_type", documentType)
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const prefix = data?.prefix ?? defaultPrefix ?? documentType.slice(0, 3).toUpperCase();
  const nextNumber = data?.next_number ?? 1;
  const padding = data?.padding ?? 4;

  res.json({ preview: `${prefix}-${String(nextNumber).padStart(padding, "0")}` });
});
