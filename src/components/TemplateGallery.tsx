import React, { useEffect, useMemo, useState } from "react";
import { Star, Copy, CircleNotch as Loader2, WarningCircle as AlertCircle, CheckSquare, ClockCounterClockwise as History, ArrowCounterClockwise as RotateCcw, PencilSimple, Plus } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";
import TemplateEditor from "./TemplateEditor";
import { isCustomBlockLayout } from "../lib/documentBlocks";
import { LoadingSwap } from "./LoadingSwap";
import { SkeletonGrid } from "./Skeleton";

interface TemplateGalleryProps {
  businessId: string;
  documentType: "invoice" | "receipt" | "quotation";
  activeTemplateIndex: number;
  /** Bridge callback: applies a gallery template to the live builder by its
   * local DESIGN_TEMPLATES index (see the "bridge" note on layout_config in
   * migration 0019 - full arbitrary-layout rendering is future work). */
  onUseTemplate: (templateIndex: number) => void;
  /** Id of the custom-blocks template currently active in the builder, if
   * any - lets a custom design show "In use" the same way a bridge one does. */
  activeCustomTemplateId?: string;
  /** Applies a real drag-and-drop-built template (layout_config.kind ===
   * "custom-blocks") to the live builder, rendered with the document's
   * actual data instead of the editor's sample values. */
  onUseCustomTemplate: (layoutConfig: any, templateId: string) => void;
}

interface GalleryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  isFavorite: boolean;
  isSystem: boolean;
  layoutConfig: { templateIndex?: number } & Record<string, unknown>;
}

interface TemplateVersion {
  id: string;
  versionNumber: number;
  layoutConfig: { templateIndex?: number };
  createdAt: string;
}

export default function TemplateGallery({
  businessId,
  documentType,
  activeTemplateIndex,
  onUseTemplate,
  activeCustomTemplateId,
  onUseCustomTemplate,
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<GalleryTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const [historyTemplate, setHistoryTemplate] = useState<GalleryTemplate | null>(null);

  useEffect(() => {
    if (!historyTemplate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHistoryTemplate(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [historyTemplate]);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  // "new" opens a blank canvas; a GalleryTemplate opens the editor pre-filled
  // with that template's own custom-blocks layout (system/bridge templates
  // never show the edit affordance, so this is always a real custom design).
  const [editorTarget, setEditorTarget] = useState<"new" | GalleryTemplate | null>(null);

  const load = () => {
    setIsLoading(true);
    api.documentTemplates
      .list({ documentType })
      .then((rows) => setTemplates(rows))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load the Template Gallery."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [documentType]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(templates.map((t) => t.category))).sort()], [templates]);
  const visible = categoryFilter === "All" ? templates : templates.filter((t) => t.category === categoryFilter);

  const toggleFavorite = async (t: GalleryTemplate) => {
    setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, isFavorite: !x.isFavorite } : x)));
    try {
      await api.documentTemplates.update(t.id, { isFavorite: !t.isFavorite });
    } catch {
      // Revert on failure - system templates can't be favorited server-side
      // yet (no per-user favorite override on shared rows); keep it honest.
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, isFavorite: t.isFavorite } : x)));
    }
  };

  const duplicate = async (t: GalleryTemplate) => {
    try {
      const copy = await api.documentTemplates.duplicate(t.id, businessId);
      setTemplates((prev) => [...prev, copy]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to duplicate this template.");
    }
  };

  const openHistory = (t: GalleryTemplate) => {
    setHistoryTemplate(t);
    setIsLoadingVersions(true);
    setVersions([]);
    api.documentTemplates
      .versions(t.id)
      .then(setVersions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load version history."))
      .finally(() => setIsLoadingVersions(false));
  };

  // Restoring an old version just re-applies its layout_config through the
  // normal update path, which snapshots the CURRENT design as a new version
  // first - so restoring is never destructive, it's always forward-moving.
  const restoreVersion = async (version: TemplateVersion) => {
    if (!historyTemplate) return;
    setIsRestoring(version.id);
    try {
      const updated = await api.documentTemplates.update(historyTemplate.id, { layoutConfig: version.layoutConfig });
      setTemplates((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setHistoryTemplate(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to restore this version.");
    } finally {
      setIsRestoring(null);
    }
  };

  return (
    <LoadingSwap isLoading={isLoading} skeleton={<SkeletonGrid count={6} />}>
    <div className="space-y-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Template Gallery</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Pick a starting design for this {documentType}, favorite the ones you use often, or duplicate one to make it your own.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditorTarget("new")}
          className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Create Custom Design
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-[10.5px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${
              categoryFilter === c ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visible.map((t) => {
          const isCustom = isCustomBlockLayout(t.layoutConfig);
          const isActive = isCustom ? t.id === activeCustomTemplateId : t.layoutConfig?.templateIndex === activeTemplateIndex;
          return (
            <div key={t.id} className={`border rounded-2xl p-3.5 space-y-2 ${isActive ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-xs truncate">{t.name}</p>
                  <span className="text-[9px] font-mono uppercase text-slate-400 tracking-wide">{t.category}</span>
                </div>
                <button type="button" onClick={() => toggleFavorite(t)} className="shrink-0 cursor-pointer" title="Favorite" aria-label="Favorite">
                  <Star className={`w-4 h-4 ${t.isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                </button>
              </div>
              <p className="text-[10.5px] text-slate-500 leading-relaxed line-clamp-2">{t.description}</p>
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={!isCustom && t.layoutConfig?.templateIndex === undefined}
                  onClick={() => (isCustom ? onUseCustomTemplate(t.layoutConfig, t.id) : onUseTemplate(t.layoutConfig!.templateIndex!))}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wide py-2 rounded-lg cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1"
                >
                  {isActive ? (
                    <>
                      <CheckSquare className="w-3 h-3" /> In use
                    </>
                  ) : (
                    "Use template"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(t)}
                  title="Duplicate" aria-label="Duplicate"
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                </button>
                {!t.isSystem && (
                  <button
                    type="button"
                    onClick={() => openHistory(t)}
                    title="Version history" aria-label="Version history"
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                )}
                {!t.isSystem && isCustomBlockLayout(t.layoutConfig) && (
                  <button
                    type="button"
                    onClick={() => setEditorTarget(t)}
                    title="Edit design" aria-label="Edit design"
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                  >
                    <PencilSimple className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && <p className="text-xs text-slate-400 italic py-6 text-center col-span-full">No templates in this category yet.</p>}
      </div>

      {/* VERSION HISTORY MODAL OVERLAY */}
      {historyTemplate && (
        <div role="dialog" aria-modal="true" aria-label="Version history" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in select-none text-left">
          <div className="bg-white text-slate-800 border border-slate-200 rounded-3xl p-6 max-w-md w-full relative space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setHistoryTemplate(null)}
              aria-label="Close"
              className="absolute top-4 right-4 w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer font-bold"
            >
              ✕
            </button>

            <div className="pr-8">
              <h4 className="font-bold text-slate-900 text-sm">Version History</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">{historyTemplate.name} - restoring an older version keeps the current one saved too.</p>
            </div>

            {isLoadingVersions ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading versions...
              </div>
            ) : versions.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">No earlier versions yet - edits to this template's design will show up here.</p>
            ) : (
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800">Version {v.versionNumber}</p>
                      <p className="text-[10px] text-slate-450 font-mono">{new Date(v.createdAt).toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreVersion(v)}
                      disabled={isRestoring !== null}
                      className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-lg cursor-pointer disabled:opacity-40 flex items-center gap-1"
                    >
                      {isRestoring === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DRAG-AND-DROP TEMPLATE EDITOR (foundation slice - see TemplateEditor.tsx) */}
      {editorTarget && (
        <TemplateEditor
          businessId={businessId}
          documentType={documentType}
          existingTemplateId={editorTarget !== "new" ? editorTarget.id : undefined}
          initialLayout={editorTarget !== "new" && isCustomBlockLayout(editorTarget.layoutConfig) ? editorTarget.layoutConfig : undefined}
          initialName={editorTarget !== "new" ? editorTarget.name : undefined}
          onSaved={() => {
            setEditorTarget(null);
            load();
          }}
          onClose={() => setEditorTarget(null)}
        />
      )}
    </div>
    </LoadingSwap>
  );
}
