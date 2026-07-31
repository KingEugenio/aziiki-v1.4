import { z } from "zod";
import { uuidField } from "./common";

export const signatureCreateSchema = z.object({
  businessId: uuidField,
  documentType: z.enum(["invoice", "receipt", "quotation"]),
  documentId: uuidField,
  signerName: z.string().trim().min(1, "A signer name is required").max(200),
  signatureKind: z.enum(["drawn", "typed"]),
  // A drawn signature is an SVG path string built from pointer coordinates;
  // a typed one is just the name again, rendered in a script font at
  // display time. 50k comfortably covers a detailed drawn signature.
  signatureData: z.string().trim().min(1).max(50_000),
});
