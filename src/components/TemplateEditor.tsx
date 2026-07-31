import React, { useEffect, useRef, useState } from "react";
import { TextT, Table, Tag, Trash, FloppyDisk, Plus } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";
import {
  DocumentBlock,
  CustomBlockLayout,
  DATA_BINDING_FIELDS,
  BLOCK_SAMPLE_DATA,
  createEmptyBlockLayout,
  resolveBlockText,
} from "../lib/documentBlocks";

interface TemplateEditorProps {
  businessId: string;
  documentType: "invoice" | "receipt" | "quotation";
  /** Editing an existing custom template vs starting a fresh one. */
  existingTemplateId?: string;
  initialLayout?: CustomBlockLayout;
  initialName?: string;
  onSaved: () => void;
  onClose: () => void;
}

let blockIdCounter = 0;
function nextBlockId() {
  blockIdCounter += 1;
  return `block-${Date.now()}-${blockIdCounter}`;
}

/**
 * A real drag-and-drop layout editor for Aziiki's document templates - this is
 * the foundation slice of that feature: add/move/resize/edit text and
 * data-bound blocks plus a single line-items table block, then save as a
 * document_templates row with layout_config.kind = "custom-blocks" (see
 * src/lib/documentBlocks.ts). Actually RENDERING a saved custom template
 * with a real invoice's live data inside InvoiceReceiptBuilder is the next
 * slice of this feature, not yet wired up here.
 */
export default function TemplateEditor({
  businessId,
  documentType,
  existingTemplateId,
  initialLayout,
  initialName,
  onSaved,
  onClose,
}: TemplateEditorProps) {
  const [layout, setLayout] = useState<CustomBlockLayout>(initialLayout ?? createEmptyBlockLayout());
  const [name, setName] = useState(initialName ?? "My Custom Design");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ id: string; startX: number; startY: number; blockX: number; blockY: number } | null>(null);
  const resizeState = useRef<{ id: string; startX: number; startY: number; width: number; height: number } | null>(null);

  // Keyboard users need a way out of a full-screen modal besides clicking
  // the Cancel button.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const selectedBlock = layout.blocks.find((b) => b.id === selectedBlockId) ?? null;

  const updateBlock = (id: string, patch: Partial<DocumentBlock>) => {
    setLayout((prev) => ({ ...prev, blocks: prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  };

  const addTextBlock = () => {
    const block: DocumentBlock = {
      id: nextBlockId(),
      type: "text",
      x: 40,
      y: 40,
      width: 220,
      height: 32,
      content: "New text",
      fontSize: 14,
      fontWeight: 500,
      color: "#0f172a",
      align: "left",
    };
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedBlockId(block.id);
  };

  const addDataFieldBlock = () => {
    const field = DATA_BINDING_FIELDS[0];
    const block: DocumentBlock = {
      id: nextBlockId(),
      type: "dataField",
      x: 40,
      y: 90,
      width: 220,
      height: 28,
      binding: field.key,
      fontSize: 13,
      fontWeight: 700,
      color: "#0f172a",
      align: "left",
    };
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedBlockId(block.id);
  };

  const addItemsTableBlock = () => {
    if (layout.blocks.some((b) => b.type === "itemsTable")) return;
    const block: DocumentBlock = {
      id: nextBlockId(),
      type: "itemsTable",
      x: 40,
      y: 300,
      width: 720,
      height: 260,
    };
    setLayout((prev) => ({ ...prev, blocks: [...prev.blocks, block] }));
    setSelectedBlockId(block.id);
  };

  const deleteSelectedBlock = () => {
    if (!selectedBlockId) return;
    setLayout((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== selectedBlockId) }));
    setSelectedBlockId(null);
  };

  const handlePointerDownOnBlock = (e: React.PointerEvent, block: DocumentBlock) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    setSelectedBlockId(block.id);
    dragState.current = { id: block.id, startX: e.clientX, startY: e.clientY, blockX: block.x, blockY: block.y };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragState.current) {
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      updateBlock(dragState.current.id, {
        x: Math.max(0, dragState.current.blockX + dx),
        y: Math.max(0, dragState.current.blockY + dy),
      });
    } else if (resizeState.current) {
      const dx = e.clientX - resizeState.current.startX;
      const dy = e.clientY - resizeState.current.startY;
      updateBlock(resizeState.current.id, {
        width: Math.max(40, resizeState.current.width + dx),
        height: Math.max(24, resizeState.current.height + dy),
      });
    }
  };

  const handlePointerUp = () => {
    dragState.current = null;
    resizeState.current = null;
  };

  const handleResizeHandlePointerDown = (e: React.PointerEvent, block: DocumentBlock) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    resizeState.current = { id: block.id, startX: e.clientX, startY: e.clientY, width: block.width, height: block.height };
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (existingTemplateId) {
        await api.documentTemplates.update(existingTemplateId, { name, layoutConfig: layout });
      } else {
        await api.documentTemplates.create({
          businessId,
          name,
          description: "Custom drag-and-drop design.",
          documentType,
          category: "Custom",
          layoutConfig: layout,
          sourceFormat: "native",
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this design.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Template Editor" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-bold text-sm text-slate-900 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500 w-72"
            placeholder="Design name"
          />
          <div className="flex items-center gap-2">
            {error && <span className="text-[11px] text-rose-600 font-bold">{error}</span>}
            <button type="button" onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FloppyDisk className="w-3.5 h-3.5" /> {isSaving ? "Saving..." : "Save Design"}
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Toolbar */}
          <div className="w-44 border-r border-slate-200 p-3 space-y-2 shrink-0 overflow-y-auto">
            <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-1">Add Block</p>
            <button type="button" onClick={addTextBlock} className="w-full flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 cursor-pointer">
              <TextT className="w-3.5 h-3.5" /> Text
            </button>
            <button type="button" onClick={addDataFieldBlock} className="w-full flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 cursor-pointer">
              <Tag className="w-3.5 h-3.5" /> Data Field
            </button>
            <button
              type="button"
              onClick={addItemsTableBlock}
              disabled={layout.blocks.some((b) => b.type === "itemsTable")}
              className="w-full flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 cursor-pointer disabled:opacity-40"
            >
              <Table className="w-3.5 h-3.5" /> Line Items Table
            </button>

            {selectedBlock && (
              <div className="pt-3 mt-3 border-t border-slate-200 space-y-2.5">
                <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold">Selected Block</p>

                {selectedBlock.type === "text" && (
                  <textarea
                    value={selectedBlock.content ?? ""}
                    onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                    rows={2}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500 resize-none"
                  />
                )}

                {selectedBlock.type === "dataField" && (
                  <select
                    value={selectedBlock.binding}
                    onChange={(e) => updateBlock(selectedBlock.id, { binding: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500"
                  >
                    {DATA_BINDING_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                )}

                {selectedBlock.type !== "itemsTable" && (
                  <>
                    <label className="text-[9px] font-mono text-slate-400 uppercase block">Font Size</label>
                    <input
                      type="number"
                      value={selectedBlock.fontSize ?? 14}
                      onChange={(e) => updateBlock(selectedBlock.id, { fontSize: Number(e.target.value) })}
                      className="w-full text-xs border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500"
                    />
                    <label className="text-[9px] font-mono text-slate-400 uppercase block">Color</label>
                    <input
                      type="color"
                      value={selectedBlock.color ?? "#0f172a"}
                      onChange={(e) => updateBlock(selectedBlock.id, { color: e.target.value })}
                      className="w-full h-8 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <label className="text-[9px] font-mono text-slate-400 uppercase block">Align</label>
                    <div className="flex gap-1">
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => updateBlock(selectedBlock.id, { align: a })}
                          className={`flex-1 text-[10px] font-bold py-1.5 rounded-md cursor-pointer ${
                            selectedBlock.align === a ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {a[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={deleteSelectedBlock}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg px-3 py-2 cursor-pointer mt-2"
                >
                  <Trash className="w-3.5 h-3.5" /> Delete Block
                </button>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
            <div
              ref={canvasRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onClick={() => setSelectedBlockId(null)}
              className="relative shrink-0 shadow-lg"
              style={{ width: layout.canvasWidth, height: layout.canvasHeight, backgroundColor: layout.background }}
            >
              {layout.blocks.length === 0 && (
                <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm font-bold pointer-events-none">
                  Add a block from the left to get started
                </p>
              )}
              {layout.blocks.map((block) => (
                <div
                  key={block.id}
                  onPointerDown={(e) => handlePointerDownOnBlock(e, block)}
                  className={`absolute cursor-move border ${selectedBlockId === block.id ? "border-emerald-500" : "border-transparent hover:border-slate-300"}`}
                  style={{ left: block.x, top: block.y, width: block.width, height: block.height }}
                >
                  {block.type === "itemsTable" ? (
                    <div className="w-full h-full border border-slate-200 rounded-lg overflow-hidden bg-white pointer-events-none">
                      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500 grid grid-cols-4">
                        <span>Description</span>
                        <span className="text-center">Qty</span>
                        <span className="text-right">Rate</span>
                        <span className="text-right">Total</span>
                      </div>
                      <div className="px-3 py-2 text-[10px] text-slate-400 italic">Line items render here</div>
                    </div>
                  ) : (
                    <div
                      className="w-full h-full flex items-start pointer-events-none whitespace-pre-wrap break-words"
                      style={{
                        fontSize: block.fontSize,
                        fontWeight: block.fontWeight,
                        color: block.color,
                        justifyContent: block.align === "center" ? "center" : block.align === "right" ? "flex-end" : "flex-start",
                        textAlign: block.align ?? "left",
                      }}
                    >
                      {resolveBlockText(block, BLOCK_SAMPLE_DATA)}
                    </div>
                  )}
                  {selectedBlockId === block.id && (
                    <div
                      onPointerDown={(e) => handleResizeHandlePointerDown(e, block)}
                      className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-emerald-600 rounded-full cursor-nwse-resize border-2 border-white shadow"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
