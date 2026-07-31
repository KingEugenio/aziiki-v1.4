/**
 * Layout format for a custom, drag-and-drop-built document template -
 * distinct from the "bridge" templates (layout_config = { templateIndex,
 * bridge: "legacy-local-template" }) that point back at the 10 hardcoded
 * designs in InvoiceReceiptBuilder.tsx. A custom template's layout_config
 * looks like { kind: "custom-blocks", canvasWidth, canvasHeight, background,
 * blocks: DocumentBlock[] }.
 *
 * `binding` (when set) means "replace this block's displayed text with the
 * live value of this field when rendering a real document" - see
 * DATA_BINDING_FIELDS below for the fields available and BLOCK_SAMPLE_DATA
 * for what the editor's own preview shows while there's no real document to
 * pull values from yet.
 */
export type DocumentBlockType = "text" | "dataField" | "itemsTable";

export interface DocumentBlock {
  id: string;
  type: DocumentBlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  binding?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

export interface CustomBlockLayout {
  kind: "custom-blocks";
  canvasWidth: number;
  canvasHeight: number;
  background: string;
  blocks: DocumentBlock[];
}

export const DEFAULT_CANVAS_WIDTH = 800;
export const DEFAULT_CANVAS_HEIGHT = 1035;

export function isCustomBlockLayout(layoutConfig: any): layoutConfig is CustomBlockLayout {
  return Boolean(layoutConfig) && layoutConfig.kind === "custom-blocks" && Array.isArray(layoutConfig.blocks);
}

export function createEmptyBlockLayout(): CustomBlockLayout {
  return {
    kind: "custom-blocks",
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT,
    background: "#ffffff",
    blocks: [],
  };
}

/** Every dynamic field a dataField block can bind to. */
export const DATA_BINDING_FIELDS: { key: string; label: string }[] = [
  { key: "business.name", label: "Business Name" },
  { key: "business.address", label: "Business Address" },
  { key: "document.type", label: "Document Type (Invoice/Receipt/Estimate)" },
  { key: "document.number", label: "Document Number" },
  { key: "document.date", label: "Issue Date" },
  { key: "document.dueDate", label: "Due Date" },
  { key: "customer.name", label: "Customer Name" },
  { key: "customer.email", label: "Customer Email" },
  { key: "document.subtotal", label: "Subtotal" },
  { key: "document.tax", label: "Tax Amount" },
  { key: "document.total", label: "Grand Total" },
];

/** Sample values the editor's own live preview shows for each binding, so a
 * user designing a template sees realistic text without a real document. */
export const BLOCK_SAMPLE_DATA: Record<string, string> = {
  "business.name": "Kofi Media Services",
  "business.address": "Accra, Ghana",
  "document.type": "INVOICE",
  "document.number": "INV-2026104",
  "document.date": "2026-07-16",
  "document.dueDate": "2026-07-30",
  "customer.name": "Yaw Mensah",
  "customer.email": "yaw@mensah.com",
  "document.subtotal": "GHS 3,450.00",
  "document.tax": "GHS 517.50",
  "document.total": "GHS 3,967.50",
};

export function resolveBlockText(block: DocumentBlock, sampleData: Record<string, string> = BLOCK_SAMPLE_DATA): string {
  if (block.type === "dataField" && block.binding) {
    return sampleData[block.binding] ?? `{{${block.binding}}}`;
  }
  return block.content ?? "";
}
