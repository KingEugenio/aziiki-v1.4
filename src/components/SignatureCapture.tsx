import React, { useEffect, useRef, useState } from "react";
import { Trash, FloppyDisk } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";

interface SignatureCaptureProps {
  businessId: string;
  documentType: "invoice" | "receipt" | "quotation";
  documentId: string;
  defaultSignerName?: string;
  onSaved: (signature: any) => void;
  onClose: () => void;
}

const CANVAS_WIDTH = 460;
const CANVAS_HEIGHT = 160;

/**
 * Captures a customer's signature against one specific document (drawn on
 * a canvas, or typed and rendered in a script font) and saves it via
 * POST /api/signatures. Scoped to the business owner capturing it in
 * person (see the migration's comment) - there's no public unauthenticated
 * signing link here.
 */
export default function SignatureCapture({
  businessId,
  documentType,
  documentId,
  defaultSignerName,
  onSaved,
  onClose,
}: SignatureCaptureProps) {
  const [mode, setMode] = useState<"drawn" | "typed">("drawn");
  const [signerName, setSignerName] = useState(defaultSignerName ?? "");
  const [typedSignature, setTypedSignature] = useState(defaultSignerName ?? "");
  const [pathPoints, setPathPoints] = useState<{ x: number; y: number }[][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const currentStroke = useRef<{ x: number; y: number }[] | null>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const getRelativePoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    isDrawing.current = true;
    currentStroke.current = [getRelativePoint(e)];
    setPathPoints((prev) => [...prev, currentStroke.current!]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing.current || !currentStroke.current) return;
    currentStroke.current.push(getRelativePoint(e));
    // Force a re-render by cloning the array reference for the last stroke.
    setPathPoints((prev) => {
      const next = [...prev];
      next[next.length - 1] = [...currentStroke.current!];
      return next;
    });
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    currentStroke.current = null;
  };

  const clearDrawing = () => setPathPoints([]);

  const strokesToSvgPaths = (): string[] =>
    pathPoints
      .filter((stroke) => stroke.length > 0)
      .map((stroke) => stroke.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "));

  const hasDrawnContent = pathPoints.some((s) => s.length > 1);

  const handleSave = async () => {
    if (!signerName.trim()) {
      setError("Please enter the signer's name.");
      return;
    }
    if (mode === "drawn" && !hasDrawnContent) {
      setError("Please draw a signature first, or switch to Type.");
      return;
    }
    if (mode === "typed" && !typedSignature.trim()) {
      setError("Please type a signature.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const signature = await api.signatures.create({
        businessId,
        documentType,
        documentId,
        signerName: signerName.trim(),
        signatureKind: mode,
        signatureData: mode === "drawn" ? JSON.stringify(strokesToSvgPaths()) : typedSignature.trim(),
      });
      onSaved(signature);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save this signature.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Sign document" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">Sign Document</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer">
            ✕
          </button>
        </div>

        {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-xs">{error}</div>}

        <div className="space-y-1">
          <label htmlFor="signer-name" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Signer Name</label>
          <input
            id="signer-name"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="e.g. Yaw Mensah"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setMode("drawn")}
            className={`flex-1 text-[10px] font-bold uppercase tracking-wide py-2 rounded-lg cursor-pointer ${mode === "drawn" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Draw
          </button>
          <button
            type="button"
            onClick={() => setMode("typed")}
            className={`flex-1 text-[10px] font-bold uppercase tracking-wide py-2 rounded-lg cursor-pointer ${mode === "typed" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            Type
          </button>
        </div>

        {mode === "drawn" ? (
          <div className="space-y-2">
            <svg
              ref={svgRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="w-full border border-dashed border-slate-300 rounded-xl bg-slate-50 cursor-crosshair touch-none"
              role="img"
              aria-label="Signature drawing pad"
            >
              {strokesToSvgPaths().map((d, i) => (
                <path key={i} d={d} fill="none" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
            <button
              type="button"
              onClick={clearDrawing}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
            >
              <Trash className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <label htmlFor="typed-signature" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Type Your Signature</label>
            <input
              id="typed-signature"
              value={typedSignature}
              onChange={(e) => setTypedSignature(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-4 text-2xl bg-slate-50 outline-none focus:border-emerald-500"
              style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3 rounded-xl transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          <FloppyDisk className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Signature"}
        </button>
      </div>
    </div>
  );
}
