import React, { useEffect, useState } from "react";
import { Palette, CheckCircle, WarningCircle as AlertCircle } from "@phosphor-icons/react";
import { api, ApiError } from "../lib/api";
import { LoadingSwap } from "./LoadingSwap";
import { SkeletonForm } from "./Skeleton";

interface BrandKitSettingsProps {
  businessId: string;
}

interface BrandKitFormState {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  registrationNumber: string;
  taxId: string;
  vatNumber: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  invoiceFooterText: string;
  receiptFooterText: string;
  legalDisclaimer: string;
}

const EMPTY_FORM: BrandKitFormState = {
  primaryColor: "#102A43",
  secondaryColor: "#006837",
  accentColor: "#F59E0B",
  registrationNumber: "",
  taxId: "",
  vatNumber: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  invoiceFooterText: "",
  receiptFooterText: "",
  legalDisclaimer: "",
};

/**
 * Every generated document (invoice/receipt/quotation, and eventually the
 * remaining document types) reads its branding from here via the
 * brand_kits table - this screen is the one place that identity is
 * actually edited.
 */
export default function BrandKitSettings({ businessId }: BrandKitSettingsProps) {
  const [form, setForm] = useState<BrandKitFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    api.brandKits
      .get(businessId)
      .then((kit) => {
        if (cancelled) return;
        if (kit) {
          setForm({
            primaryColor: kit.primaryColor ?? EMPTY_FORM.primaryColor,
            secondaryColor: kit.secondaryColor ?? EMPTY_FORM.secondaryColor,
            accentColor: kit.accentColor ?? EMPTY_FORM.accentColor,
            registrationNumber: kit.registrationNumber ?? "",
            taxId: kit.taxId ?? "",
            vatNumber: kit.vatNumber ?? "",
            address: kit.address ?? "",
            phone: kit.phone ?? "",
            email: kit.email ?? "",
            website: kit.website ?? "",
            invoiceFooterText: kit.invoiceFooterText ?? "",
            receiptFooterText: kit.receiptFooterText ?? "",
            legalDisclaimer: kit.legalDisclaimer ?? "",
          });
        }
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load your Brand Kit."))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const update = <K extends keyof BrandKitFormState>(key: K, value: BrandKitFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await api.brandKits.save({ businessId, ...form });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save your Brand Kit.");
    } finally {
      setIsSaving(false);
    }
  };

  const colorField = (label: string, key: "primaryColor" | "secondaryColor" | "accentColor") => (
    <div className="space-y-1">
      <label htmlFor={`brandkit-${key}`} className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">{label}</label>
      <div className="flex items-center gap-2">
        <input
          id={`brandkit-${key}`}
          type="color"
          value={form[key]}
          onChange={(e) => update(key, e.target.value)}
          className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
        />
        <input
          type="text"
          aria-label={`${label} hex value`}
          value={form[key]}
          onChange={(e) => update(key, e.target.value)}
          className="flex-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg p-2 font-mono text-xs outline-none focus:border-emerald-500"
        />
      </div>
    </div>
  );

  return (
    <LoadingSwap isLoading={isLoading} skeleton={<SkeletonForm />}>
    <div className="max-w-2xl mx-auto space-y-5 text-left">
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4 text-emerald-600" />
        <h3 className="font-bold text-slate-900 text-sm">Brand Kit</h3>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed -mt-2">
        Every invoice, receipt, and quotation you generate pulls its colors, tax details, and footer
        text from here automatically.
      </p>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl flex items-start gap-2 text-xs">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> Brand Kit saved.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {colorField("Primary Color", "primaryColor")}
          {colorField("Secondary Color", "secondaryColor")}
          {colorField("Accent Color", "accentColor")}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label htmlFor="brandkit-registrationNumber" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Registration No.</label>
            <input id="brandkit-registrationNumber" value={form.registrationNumber} onChange={(e) => update("registrationNumber", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
          </div>
          <div className="space-y-1">
            <label htmlFor="brandkit-taxId" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Tax ID</label>
            <input id="brandkit-taxId" value={form.taxId} onChange={(e) => update("taxId", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
          </div>
          <div className="space-y-1">
            <label htmlFor="brandkit-vatNumber" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">VAT Number</label>
            <input id="brandkit-vatNumber" value={form.vatNumber} onChange={(e) => update("vatNumber", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="brandkit-address" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Business Address</label>
          <input id="brandkit-address" value={form.address} onChange={(e) => update("address", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label htmlFor="brandkit-phone" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Phone</label>
            <input id="brandkit-phone" value={form.phone} onChange={(e) => update("phone", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
          </div>
          <div className="space-y-1">
            <label htmlFor="brandkit-email" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Email</label>
            <input id="brandkit-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
          </div>
          <div className="space-y-1">
            <label htmlFor="brandkit-website" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Website</label>
            <input id="brandkit-website" value={form.website} onChange={(e) => update("website", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="brandkit-invoiceFooterText" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Invoice Footer Text</label>
          <textarea id="brandkit-invoiceFooterText" rows={2} value={form.invoiceFooterText} onChange={(e) => update("invoiceFooterText", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500 resize-none" />
        </div>
        <div className="space-y-1">
          <label htmlFor="brandkit-receiptFooterText" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Receipt Footer Text</label>
          <textarea id="brandkit-receiptFooterText" rows={2} value={form.receiptFooterText} onChange={(e) => update("receiptFooterText", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500 resize-none" />
        </div>
        <div className="space-y-1">
          <label htmlFor="brandkit-legalDisclaimer" className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Legal Disclaimer</label>
          <textarea id="brandkit-legalDisclaimer" rows={2} value={form.legalDisclaimer} onChange={(e) => update("legalDisclaimer", e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500 resize-none" />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? "Saving..." : "Save Brand Kit"}
        </button>
      </form>
    </div>
    </LoadingSwap>
  );
}
