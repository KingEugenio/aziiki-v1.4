import { Router, type Request, type Response } from "express";
import { signatureCreateSchema } from "../validation/signatures";

export const signaturesRouter = Router();

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    documentType: row.document_type,
    documentId: row.document_id,
    signerName: row.signer_name,
    signatureKind: row.signature_kind,
    signatureData: row.signature_data,
    signedAt: row.signed_at,
  };
}

// Looks up the most recent signature captured against one specific
// document (an invoice/receipt/quotation), if any - used to render it on
// that document's preview.
signaturesRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const { documentType, documentId } = req.query;

  if (typeof documentType !== "string" || typeof documentId !== "string") {
    res.status(400).json({ error: "documentType and documentId query params are required" });
    return;
  }

  const { data, error } = await supabase
    .from("document_signatures")
    .select("*")
    .eq("document_type", documentType)
    .eq("document_id", documentId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: data ? fromRow(data) : null });
});

signaturesRouter.post("/", async (req: Request, res: Response) => {
  const parsed = signatureCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  const { data, error } = await supabase
    .from("document_signatures")
    .insert({
      user_id: userId,
      business_id: input.businessId,
      document_type: input.documentType,
      document_id: input.documentId,
      signer_name: input.signerName,
      signature_kind: input.signatureKind,
      signature_data: input.signatureData,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ data: fromRow(data) });
});

signaturesRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("document_signatures")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.status(204).send();
});
