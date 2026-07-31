import { Router, type Request, type Response } from "express";
import { documentTemplateCreateSchema, documentTemplateUpdateSchema } from "../validation/documentTemplates";
import { cached, invalidate } from "../redis";

const CACHE_TTL_SECONDS = 60; // templates change rarely - safe to cache a bit longer than transactional data

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id ?? undefined,
    name: row.name,
    description: row.description ?? "",
    documentType: row.document_type,
    category: row.category,
    layoutConfig: row.layout_config ?? {},
    thumbnailUrl: row.thumbnail_url ?? undefined,
    tags: row.tags ?? [],
    folder: row.folder ?? undefined,
    isFavorite: row.is_favorite,
    isSystem: row.is_system,
    sourceFormat: row.source_format ?? "native",
    isPublic: row.is_public,
    version: row.version,
  };
}

export const documentTemplatesRouter = Router();

// Lists every template visible to the caller (their own + Aziiki system
// templates, per the select RLS policy), optionally narrowed by query
// params. Cached per-user since the visible set rarely changes.
documentTemplatesRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const allRows = await cached(`cache:document_templates:${userId}`, CACHE_TTL_SECONDS, async () => {
    const { data, error } = await supabase.from("document_templates").select("*").order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

  let rows = allRows;
  const { documentType, category, folder, favoriteOnly, search } = req.query;
  if (typeof documentType === "string") rows = rows.filter((r: any) => r.document_type === documentType);
  if (typeof category === "string") rows = rows.filter((r: any) => r.category === category);
  if (typeof folder === "string") rows = rows.filter((r: any) => r.folder === folder);
  if (favoriteOnly === "true") rows = rows.filter((r: any) => r.is_favorite);
  if (typeof search === "string" && search.trim()) {
    const term = search.trim().toLowerCase();
    rows = rows.filter(
      (r: any) =>
        r.name.toLowerCase().includes(term) ||
        (r.tags ?? []).some((t: string) => t.toLowerCase().includes(term))
    );
  }

  res.json({ data: rows.map(fromRow) });
});

documentTemplatesRouter.post("/", async (req: Request, res: Response) => {
  const parsed = documentTemplateCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  const { data, error } = await supabase
    .from("document_templates")
    .insert({
      user_id: userId,
      business_id: input.businessId,
      name: input.name,
      description: input.description,
      document_type: input.documentType,
      category: input.category,
      layout_config: input.layoutConfig,
      thumbnail_url: input.thumbnailUrl,
      tags: input.tags,
      folder: input.folder,
      source_format: input.sourceFormat,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  await invalidate(`cache:document_templates:${userId}`);
  res.status(201).json({ data: fromRow(data) });
});

documentTemplatesRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = documentTemplateUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  const row: Record<string, unknown> = {};
  if (input.name !== undefined) row.name = input.name;
  if (input.description !== undefined) row.description = input.description;
  if (input.category !== undefined) row.category = input.category;
  if (input.thumbnailUrl !== undefined) row.thumbnail_url = input.thumbnailUrl;
  if (input.tags !== undefined) row.tags = input.tags;
  if (input.folder !== undefined) row.folder = input.folder;
  if (input.isFavorite !== undefined) row.is_favorite = input.isFavorite;

  // Editing the design itself is versioned: snapshot the OLD layout_config
  // into document_template_versions before overwriting it.
  if (input.layoutConfig !== undefined) {
    const { data: existing } = await supabase
      .from("document_templates")
      .select("layout_config, version")
      .eq("id", req.params.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("document_template_versions").insert({
        template_id: req.params.id,
        user_id: userId,
        version_number: existing.version,
        layout_config: existing.layout_config,
      });
    }
    row.layout_config = input.layoutConfig;
    row.version = (existing?.version ?? 1) + 1;
  }

  if (Object.keys(row).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  const { data, error } = await supabase
    .from("document_templates")
    .update(row)
    .eq("id", req.params.id)
    .select("*")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await invalidate(`cache:document_templates:${userId}`);
  res.json({ data: fromRow(data) });
});

documentTemplatesRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("document_templates")
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

  await invalidate(`cache:document_templates:${userId}`);
  res.status(204).send();
});

// Duplicates any template the caller can see (their own, or a Aziiki system
// template) into a new, editable copy owned by them - the standard "start
// from a starter template" flow.
documentTemplatesRouter.post("/:id/duplicate", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const businessId = typeof req.body?.businessId === "string" ? req.body.businessId : undefined;
  if (!businessId) {
    res.status(400).json({ error: "businessId is required" });
    return;
  }

  const { data: source, error: sourceError } = await supabase
    .from("document_templates")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (sourceError) {
    res.status(400).json({ error: sourceError.message });
    return;
  }
  if (!source) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { data, error } = await supabase
    .from("document_templates")
    .insert({
      user_id: userId,
      business_id: businessId,
      name: `${source.name} (Copy)`,
      description: source.description,
      document_type: source.document_type,
      category: source.category,
      layout_config: source.layout_config,
      thumbnail_url: source.thumbnail_url,
      tags: source.tags,
      source_format: source.source_format,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  await invalidate(`cache:document_templates:${userId}`);
  res.status(201).json({ data: fromRow(data) });
});

documentTemplatesRouter.get("/:id/versions", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("document_template_versions")
    .select("*")
    .eq("template_id", req.params.id)
    .order("version_number", { ascending: false });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({
    data: (data ?? []).map((v: any) => ({
      id: v.id,
      versionNumber: v.version_number,
      layoutConfig: v.layout_config,
      createdAt: v.created_at,
    })),
  });
});
