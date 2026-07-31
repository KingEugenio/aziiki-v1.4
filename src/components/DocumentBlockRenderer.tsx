import React from "react";
import { CustomBlockLayout, DocumentBlock } from "../lib/documentBlocks";

export interface RealDocumentData {
  [key: string]: string;
  "business.name": string;
  "business.address": string;
  "document.type": string;
  "document.number": string;
  "document.date": string;
  "document.dueDate": string;
  "customer.name": string;
  "customer.email": string;
  "document.subtotal": string;
  "document.tax": string;
  "document.total": string;
}

interface LineItemRow {
  description: string;
  quantity: number;
  rate: number;
  total: number;
}

interface DocumentBlockRendererProps {
  layout: CustomBlockLayout;
  data: RealDocumentData;
  items: LineItemRow[];
  currencySymbol: string;
}

function blockText(block: DocumentBlock, data: RealDocumentData): string {
  if (block.type === "dataField" && block.binding) {
    return data[block.binding] ?? `{{${block.binding}}}`;
  }
  return block.content ?? "";
}

/**
 * Renders a saved custom-blocks template (built in TemplateEditor.tsx) with
 * a real document's actual data - the live-rendering counterpart to that
 * editor's own sample-data preview. Used by InvoiceReceiptBuilder whenever
 * a custom template (rather than one of the 10 built-in "bridge" designs)
 * is the active one.
 */
export default function DocumentBlockRenderer({ layout, data, items, currencySymbol }: DocumentBlockRendererProps) {
  return (
    <div className="relative mx-auto" style={{ width: layout.canvasWidth, height: layout.canvasHeight, backgroundColor: layout.background }}>
      {layout.blocks.map((block) => (
        <div key={block.id} className="absolute" style={{ left: block.x, top: block.y, width: block.width, height: block.height }}>
          {block.type === "itemsTable" ? (
            <div className="w-full h-full border border-slate-200 rounded-lg overflow-hidden bg-white">
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500 grid grid-cols-4">
                <span>Description</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Total</span>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto" style={{ maxHeight: block.height - 32 }}>
                {items.length === 0 ? (
                  <div className="px-3 py-3 text-[10px] text-slate-400 italic">No line items yet</div>
                ) : (
                  items.map((item, idx) => (
                    <div key={idx} className="px-3 py-2 text-[11px] text-slate-700 grid grid-cols-4 items-center">
                      <span className="truncate font-medium">{item.description || "Untitled item"}</span>
                      <span className="text-center font-mono">{item.quantity}</span>
                      <span className="text-right font-mono">{currencySymbol}{item.rate.toLocaleString()}</span>
                      <span className="text-right font-mono font-bold">{currencySymbol}{item.total.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div
              className="w-full h-full flex items-start whitespace-pre-wrap break-words"
              style={{
                fontSize: block.fontSize,
                fontWeight: block.fontWeight,
                color: block.color,
                justifyContent: block.align === "center" ? "center" : block.align === "right" ? "flex-end" : "flex-start",
                textAlign: block.align ?? "left",
              }}
            >
              {blockText(block, data)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
