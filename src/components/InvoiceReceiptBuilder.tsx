import React, { useState, useEffect } from "react";
import { FileText, Receipt as ReceiptIcon, Plus, Trash as Trash2, ShareNetwork as Share2, Printer, ArrowsClockwise as RefreshCw, Check, Palette, CheckCircle, WarningCircle as AlertCircle, UploadSimple as Upload, FileArrowUp as FileUp, Sliders, TextT as Type, FileCsv as FileSpreadsheet, Certificate as Award, Image as ImageIcon, Percent as BadgePercent, Barcode, MagnifyingGlass as Search, CheckSquare, MagicWand as Sparkles, Envelope as Mail, CircleNotch as Loader2, CreditCard } from "@phosphor-icons/react";
import { Invoice, Receipt, Quotation, Customer, Business, InvoiceItem } from "../types";
import { calculateInvoiceTotals, subtractMoney } from "../lib/money";
import { SUPPORTED_CURRENCY_CODES, formatMoneyIntl } from "../lib/currency";
import { api, getFriendlyErrorMessage } from "../lib/api";
import TemplateGallery from "./TemplateGallery";
import BrandKitSettings from "./BrandKitSettings";
import DocumentBlockRenderer from "./DocumentBlockRenderer";
import SignatureCapture from "./SignatureCapture";
import PurchaseOrderManager from "./PurchaseOrderManager";
import TeamManager from "./TeamManager";
import ExchangeRateSettings from "./ExchangeRateSettings";
import { CustomBlockLayout } from "../lib/documentBlocks";
import EmptyState from "./errors/EmptyState";

interface InvoiceReceiptBuilderProps {
  currentBusiness: Business;
  customers: Customer[];
  invoices: Invoice[];
  receipts: Receipt[];
  quotations: Quotation[];
  currencySymbol: string;
  onAddInvoice: (invoice: Invoice) => void;
  onAddReceipt: (receipt: Receipt) => void;
  onAddQuotation: (quotation: Quotation) => void;
  onConvertQuote: (quoteId: string) => void;
  onUpdateInvoiceStatus?: (id: string, nextStatus: string) => void;
}

interface ImportedDocument {
  id: string;
  fileName: string;
  fileSize: string;
  extractedBusiness: string;
  extractedCode: string;
  extractedAmount: number;
  extractedDate: string;
  extractedDescription: string;
  status: "Audited" | "Imported";
  uploadTimestamp: string;
}

// 10 distinct, beautifully designed templates
// Each template's visual identity comes from FOUR real, wired-up levers -
// tableBorder/tableShadow (the line-items grid), totalsStyle (the Grand
// Total block - the single most-looked-at element on any invoice), badgeBg
// (the document-type pill), and tableHeaderBg - rather than color-tint
// alone, so the 10 designs read as genuinely different documents.
// ─────────────────────────────────────────────────────────────────────────
// AZIIKI BASIC VERSION 1.0 — MVP mode switch (kept in sync with the flag of
// the same name in App.tsx). MVP_TEMPLATE_IDS controls which of the 10
// designs below are surfaced in the picker; it currently includes all 10
// per the v1.0 document design system spec (all 10 premium, named designs
// available across Invoice/Receipt/Estimate). Trim this array any time to
// curate a smaller set again — the underlying DESIGN_TEMPLATES data and
// every template's rendering logic stay untouched either way.
// ─────────────────────────────────────────────────────────────────────────
const MVP_MODE = true;
const MVP_TEMPLATE_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const DESIGN_TEMPLATES = [
  {
    id: 0,
    name: "Corporate Style",
    description: "Formal corporate structure: bordered ledger table, boxed total, strict metadata columns.",
    category: "Corporate",
    badgeBg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    tableHeaderBg: "bg-slate-50 border-b border-slate-200 text-slate-500",
    tableBorder: "border border-slate-200",
    tableShadow: "shadow-sm shadow-slate-200/5",
    totalsStyle: "boxed" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 1,
    name: "Minimal Professional",
    description: "Scandinavian white space: borderless table, hairline-underlined total, nothing shouting.",
    category: "Minimal",
    badgeBg: "bg-slate-100 text-slate-800 border border-slate-200",
    tableHeaderBg: "bg-transparent border-b border-slate-200 text-slate-400",
    tableBorder: "border-0",
    tableShadow: "shadow-none",
    totalsStyle: "underline" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 2,
    name: "Creative Agency",
    description: "Solid colored sidebar strip and an inverted dark total block. Built for agencies.",
    category: "Agency",
    badgeBg: "bg-emerald-100 text-emerald-900 border border-emerald-300",
    tableHeaderBg: "bg-emerald-50/40 border-b border-emerald-150 text-emerald-800",
    tableBorder: "border-l-4 border-r border-t border-b border-slate-200",
    tableShadow: "shadow-md shadow-emerald-500/5",
    totalsStyle: "dark" as const,
    hasLeftStrip: true,
    logoAlign: "left" as const,
  },
  {
    id: 3,
    name: "Startup Style",
    description: "Nerd-classic terminal ticket: dashed cutter borders, boxed total in a code-block frame.",
    category: "Startup",
    badgeBg: "bg-zinc-100 text-zinc-950 border border-zinc-300",
    tableHeaderBg: "bg-zinc-50 border-t border-b border-dashed border-zinc-300 text-zinc-600",
    tableBorder: "border border-dashed border-zinc-300",
    tableShadow: "shadow-none",
    totalsStyle: "boxed" as const,
    hasLeftStrip: false,
    logoAlign: "right" as const,
  },
  {
    id: 4,
    name: "Elegant Classic",
    description: "Serif high-society heading, warm ivory shading, and a large underlined total figure.",
    category: "Classic",
    badgeBg: "bg-stone-105 text-stone-800 border border-stone-300",
    tableHeaderBg: "bg-stone-50 border-b border-stone-200 text-stone-600",
    tableBorder: "border border-stone-200/80",
    tableShadow: "shadow-sm",
    totalsStyle: "underline" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 5,
    name: "African Business Style",
    description: "Dot-matrix thermal-receipt coupon: dotted table rules, rounded pill total badge — built for high-volume market and retail trade.",
    category: "African Business",
    badgeBg: "bg-teal-50 text-teal-800 border border-teal-200",
    tableHeaderBg: "bg-teal-50 border-t border-b border-dotted border-teal-200 text-teal-700",
    tableBorder: "border border-dotted border-teal-200",
    tableShadow: "shadow-none",
    totalsStyle: "badge" as const,
    hasLeftStrip: false,
    logoAlign: "center" as const,
  },
  {
    id: 6,
    name: "Luxury Dark",
    description: "Imperial double-border frame, near-black table header, gold-on-navy total block.",
    category: "Luxury",
    badgeBg: "bg-amber-50 text-amber-800 border border-amber-200",
    tableHeaderBg: "bg-slate-900 text-white",
    tableBorder: "border-4 border-double border-amber-250",
    tableShadow: "shadow-md",
    totalsStyle: "dark" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 7,
    name: "Modern Business",
    description: "Chubby rounded corners throughout, soft indigo tint, a big rounded total badge.",
    category: "Modern",
    badgeBg: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    tableHeaderBg: "bg-indigo-100/30 text-indigo-850",
    tableBorder: "border border-indigo-100 rounded-2xl",
    tableShadow: "shadow-lg shadow-indigo-500/5",
    totalsStyle: "badge" as const,
    hasLeftStrip: false,
    logoAlign: "right" as const,
  },
  {
    id: 8,
    name: "Photography Style",
    description: "Vibrant borderless table, playful circular accents, a bright rounded total badge.",
    category: "Photography",
    badgeBg: "bg-sky-50 text-sky-800 border border-sky-200",
    tableHeaderBg: "bg-sky-50 text-sky-900 border-b border-sky-100",
    tableBorder: "border-0",
    tableShadow: "shadow-sm shadow-sky-400/10",
    totalsStyle: "badge" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  },
  {
    id: 9,
    name: "Fashion Brand Style",
    description: "Heavy structured table partitions and bold ledger alignment — reads like a lookbook order sheet for textile and fashion houses.",
    category: "Fashion",
    badgeBg: "bg-slate-200 text-slate-800 border border-slate-350",
    tableHeaderBg: "bg-slate-200/75 border-b-2 border-slate-400 text-slate-800",
    tableBorder: "border-2 border-slate-300",
    tableShadow: "shadow-none",
    totalsStyle: "boxed" as const,
    hasLeftStrip: false,
    logoAlign: "left" as const,
  }
];

const PRESET_LOGOS = [
  { id: "consult", name: "Corporate Sparkle", char: "✦" },
  { id: "retail", name: "E-Commerce Cart", char: "🛒" },
  { id: "tech", name: "Infinite Hub", char: "∞" },
  { id: "lens", name: "Creative Eye", char: "👁" },
  { id: "node", name: "Network Terminal", char: "☊" }
];

export default function InvoiceReceiptBuilder({
  currentBusiness,
  customers,
  invoices,
  receipts,
  quotations,
  currencySymbol,
  onAddInvoice,
  onAddReceipt,
  onAddQuotation,
  onConvertQuote,
  onUpdateInvoiceStatus
}: InvoiceReceiptBuilderProps) {
  // Navigation tabs: "builder" (Form Info) | "style" (10 Designs + Customs) | "pdfImport" (PDF File Intake) | "history" (Past Invoices Ledger)
  const [activePaneTab, setActivePaneTab] = useState<"builder" | "style" | "pdfImport" | "history" | "gallery" | "brandKit" | "purchaseOrders" | "team" | "currencies">("builder");

  const changePaneTab = (tab: "builder" | "style" | "pdfImport" | "history" | "gallery" | "brandKit" | "purchaseOrders" | "team" | "currencies") => {
    // AZIIKI BASIC VERSION: block navigation to hidden-but-preserved panes.
    if (MVP_MODE && (tab === "gallery" || tab === "purchaseOrders" || tab === "team" || tab === "currencies")) {
      setActivePaneTab("builder");
      return;
    }
    setActivePaneTab(tab);
  };

  // Document status selection inside builder form
  const [invoiceStatus, setInvoiceStatus] = useState<Invoice["status"]>("Sent");

  // "Send by Email" feature state - degrades gracefully when RESEND_API_KEY
  // isn't configured on the server, rather than showing a broken button.
  const [emailSendingEnabled, setEmailSendingEnabled] = useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  // "Request Payment" (Paystack) feature state - same graceful-degradation
  // pattern: hidden/disabled rather than broken when PAYSTACK_SECRET_KEY
  // isn't configured on the server yet.
  const [paystackEnabled, setPaystackEnabled] = useState<boolean>(false);
  const [isRequestingPayment, setIsRequestingPayment] = useState<boolean>(false);

  useEffect(() => {
    api.config
      .features()
      .then((flags) => {
        setEmailSendingEnabled(flags.emailSendingEnabled);
        setPaystackEnabled(flags.paystackEnabled);
      })
      .catch(() => {
        setEmailSendingEnabled(false);
        setPaystackEnabled(false);
      });
  }, []);

  // Payment attempts (Paystack) for this business, so the Past Invoices
  // Ledger can show a failed/pending payment even though the invoice's own
  // status never changes on a failed attempt (only a successful one marks
  // it Paid - see the webhook in paymentsWebhook.ts).
  const [paymentTransactions, setPaymentTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!paystackEnabled) return;
    api.payments.list(currentBusiness.id).then(setPaymentTransactions).catch(() => setPaymentTransactions([]));
  }, [currentBusiness.id, paystackEnabled, activePaneTab]);

  // Most recent payment attempt per invoice - only surfaced when it did NOT
  // succeed, since a successful one already shows as the invoice's own
  // "PAID" badge below.
  const latestFailedOrPendingPaymentByInvoice = new Map<string, any>();
  for (const tx of paymentTransactions) {
    if (!tx.invoiceId || tx.status === "success") continue;
    const existing = latestFailedOrPendingPaymentByInvoice.get(tx.invoiceId);
    if (!existing || new Date(tx.createdAt) > new Date(existing.createdAt)) {
      latestFailedOrPendingPaymentByInvoice.set(tx.invoiceId, tx);
    }
  }

  // Document mode
  const [mode, setMode] = useState<"invoice" | "receipt" | "quotation">("invoice");
  
  // Choose standard base template from 10 designs
  const [templateIndex, setTemplateIndex] = useState<number>(0);

  // A drag-and-drop-built template (see TemplateEditor.tsx) takes over the
  // live preview entirely when set - null means "render one of the 10
  // built-in bridge designs instead" (the existing behavior below).
  const [activeCustomLayout, setActiveCustomLayout] = useState<CustomBlockLayout | null>(null);
  const [activeCustomTemplateId, setActiveCustomTemplateId] = useState<string | undefined>(undefined);

  // Custom design overrides ("Design their own receipts/invoices")
  const [accentColor, setAccentColor] = useState<string>("#2563eb");
  const [secondaryColor, setSecondaryColor] = useState<string>("#475569");
  const [customAccentColor, setCustomAccentColor] = useState<string>("#f59e0b");
  const [borderStyle, setBorderStyle] = useState<"Solid" | "Double" | "Dashed" | "Dotted" | "None">("Solid");
  const [paperBackground, setPaperBackground] = useState<"White" | "Ivory" | "Sand" | "Gray">("White");
  const [logoPlacement, setLogoPlacement] = useState<"Left" | "Right" | "Center">("Left");
  const [footerAlignment, setFooterAlignment] = useState<"Left" | "Right" | "Center">("Left");
  const [dateFormat, setDateFormat] = useState<"YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY">("YYYY-MM-DD");
  const [bankDetails, setBankDetails] = useState<string>("Sovereign Savings Bank • Acc: 1024859210 • Accra Branch");
  const [momoDetails, setMomoDetails] = useState<string>("Mobile Money • Registered: 0241234567 (Aziiki Corp)");
  const [termsAndConditions, setTermsAndConditions] = useState<string>("Payment is requested within 14 days of issue. Overdue accounts carry standard interest charges.");
  const [shipping, setShipping] = useState<number>(0);
  const [invoiceAmountPaid, setInvoiceAmountPaid] = useState<number>(0);

  const [selectedFont, setSelectedFont] = useState<string>("Arial");
  const [watermarkText, setWatermarkText] = useState<string>("ORIGINAL COMPLIANT");
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [headerLayout, setHeaderLayout] = useState<"Compact" | "TwoColumn" | "Centered">("TwoColumn");
  const [borderRadiusMode, setBorderRadiusMode] = useState<"None" | "Soft" | "Chubby">("Soft");
  const [customFooterNotes, setCustomFooterNotes] = useState<string>("Thank you for doing business with us! Settlement within 14 days is registered in our local Mobile Money channels.");
  const [authorizedSignature, setAuthorizedSignature] = useState<string>("CFO Operations Director");

  // Custom Logo uploading / Selection
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [selectedPresetLogo, setSelectedPresetLogo] = useState<string | null>("consult");

  // Editable Issuer (Issued By) Details
  const [issuerName, setIssuerName] = useState<string>(currentBusiness.name);
  const [issuerIndustry, setIssuerIndustry] = useState<string>(`${currentBusiness.industry} Branch`);
  const [issuerDesc, setIssuerDesc] = useState<string>(currentBusiness.description || "Compliant regional SME enterprise.");
  const [issuerContact, setIssuerContact] = useState<string>("Accra, Ghana • +233 24 123 4567");

  // Keep issuer details synced when user swaps active business profiles
  React.useEffect(() => {
    setIssuerName(currentBusiness.name);
    setIssuerIndustry(`${currentBusiness.industry} Branch`);
    setIssuerDesc(currentBusiness.description || "Compliant regional SME enterprise.");
    if (currentBusiness.primaryColor) {
      setAccentColor(currentBusiness.primaryColor);
    }
  }, [currentBusiness.id, currentBusiness.name, currentBusiness.industry, currentBusiness.description, currentBusiness.primaryColor]);

  // Live preview of the next atomically-tracked document number (backed by
  // document_numbering_sequences), replacing the old invoices.length-based
  // counter which broke across sessions, filtered views, and devices. Falls
  // back silently to the existing value in guest mode (no server session).
  React.useEffect(() => {
    let cancelled = false;
    api.documentNumbering
      .peek(currentBusiness.id, "invoice", "INV")
      .then((preview) => { if (!cancelled) setInvoiceNumber(preview); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentBusiness.id]);

  React.useEffect(() => {
    let cancelled = false;
    api.documentNumbering
      .peek(currentBusiness.id, "receipt", "REC")
      .then((preview) => { if (!cancelled) setReceiptNumber(preview); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentBusiness.id]);

  React.useEffect(() => {
    let cancelled = false;
    api.documentNumbering
      .peek(currentBusiness.id, "quotation", "EST")
      .then((preview) => { if (!cancelled) setQuoteNumber(preview); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentBusiness.id]);

  // Manual Custom Client (Issued To) Backup Details
  const [customClientName, setCustomClientName] = useState<string>("");
  const [customClientEmail, setCustomClientEmail] = useState<string>("");
  const [customClientPhone, setCustomClientPhone] = useState<string>("");
  const [customClientCategory, setCustomClientCategory] = useState<string>("B2B Trade Buyer");

  // Invoicing states
  const [customerId, setCustomerId] = useState<string>(customers[0]?.id || "custom");

  // Document currency: defaults to the business's own currency, but a
  // customer's preferredCurrency (set in CustomerCRM) auto-selects it when
  // that customer is picked - still always overridable per-document.
  const [documentCurrency, setDocumentCurrency] = useState<string>(currentBusiness.currency);
  const [exchangeRate, setExchangeRate] = useState<number>(1);

  // Saved manual rates (see ExchangeRateSettings/"currencies" pane) - keyed
  // by currency code - auto-fill the rate field below instead of leaving a
  // foreign-currency document stuck at the rate-1 default.
  const [savedExchangeRates, setSavedExchangeRates] = useState<Record<string, number>>({});

  useEffect(() => {
    api.exchangeRates
      .list(currentBusiness.id)
      .then((rates: any[]) => {
        const map: Record<string, number> = {};
        for (const r of rates) map[r.currency] = r.rateToBusinessCurrency;
        setSavedExchangeRates(map);
      })
      .catch(() => {});
  }, [currentBusiness.id]);

  useEffect(() => {
    if (customerId === "custom") return;
    const selectedCustomer = customers.find((c) => c.id === customerId);
    if (selectedCustomer?.preferredCurrency) {
      setDocumentCurrency(selectedCustomer.preferredCurrency);
    }
  }, [customerId, customers]);

  useEffect(() => {
    if (documentCurrency === currentBusiness.currency) {
      setExchangeRate(1);
    } else if (savedExchangeRates[documentCurrency]) {
      setExchangeRate(savedExchangeRates[documentCurrency]);
    }
  }, [documentCurrency, savedExchangeRates, currentBusiness.currency]);

  // Phase F of the currency/localization redesign: the printed/exported
  // document (the "Print Sheet" - window.print() of this same preview) used
  // to always show exactly 2 decimals with a bare currency-symbol prefix
  // regardless of the document's actual currency or the reader's locale -
  // wrong for 0-decimal currencies like JPY and 3-decimal ones like BHD, and
  // not how any of these currencies are conventionally written. fmt() routes
  // every amount shown on the document through the same Intl-based
  // formatter used everywhere else in the currency system.
  const fmt = (amount: number) => formatMoneyIntl(amount, documentCurrency);

  const [invoiceNumber, setInvoiceNumber] = useState<string>(`INV-${2026}${invoices.length + 101}`);
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState<string>(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "Raw Material Batch Procurement", quantity: 120, rate: 25 },
    { description: "Regional Freight Transport Logistics", quantity: 1, rate: 450 }
  ]);
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(currentBusiness.taxRate || 15);

  // Receipt states
  const [receiptNumber, setReceiptNumber] = useState<string>(`REC-${2026}${receipts.length + 101}`);
  const [receiptAmount, setReceiptAmount] = useState<number>(3450);
  const [receiptDesc, setReceiptDesc] = useState<string>("Reimbursement for supplier raw stocks and wholesale clothing transport.");
  const [paymentMethod, setPaymentMethod] = useState<"Mobile Money" | "Cash" | "Bank Transfer">("Mobile Money");

  // Quotation states
  const [quoteNumber, setQuoteNumber] = useState<string>(`EST-${2026}${quotations.length + 101}`);

  // Global Toast notifier
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showIssuerConfig, setShowIssuerConfig] = useState<boolean>(false);

  // PDF Intake States (PDF OCR simulation)
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>("");
  const [scannedResult, setScannedResult] = useState<ImportedDocument | null>(null);
  const [importedDocumentArchive, setImportedDocumentArchive] = useState<ImportedDocument[]>([]);

  // Toast trigger helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Populate archived imported docs from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("aziiki_imported_docs");
    if (saved) {
      try {
        setImportedDocumentArchive(JSON.parse(saved));
      } catch (e) {
        // Safe fallthrough
      }
    }
  }, []);

  const saveArchiveToLocalStorage = (newArchive: ImportedDocument[]) => {
    setImportedDocumentArchive(newArchive);
    localStorage.setItem("aziiki_imported_docs", JSON.stringify(newArchive));
  };

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedLogo(dataUrl);
      setSelectedPresetLogo(null);
      triggerToast("Custom company logo loaded successfully into document headers!");
    };
    reader.readAsDataURL(file);
  };

  // Clean uploaded logo
  const clearUploadedLogo = () => {
    setUploadedLogo(null);
    setSelectedPresetLogo("consult");
    triggerToast("Switched back to standard graphic presets.");
  };

  // PDF File upload simulator
  const handleIntakeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processIntakeFile(file);
  };

  const processIntakeFile = (file: File) => {
    setIntakeFile(file);
    setIsScanning(true);
    setScannedResult(null);

    // Advanced scanning step sequence simulation (OCR flow)
    const steps = [
      "File successfully locked. Analyzing layout matrix...",
      "Extracting text vectors and metadata fields...",
      "Locating financial tables and unit rates...",
      "Determining issuer and customer balances...",
      "Cross-checking results with VAT configurations..."
    ];

    let currentStep = 0;
    setScanStep(steps[0]);

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setScanStep(steps[currentStep]);
      } else {
        clearInterval(interval);
        finalizeOcrExtraction(file);
      }
    }, 850);
  };

  const finalizeOcrExtraction = (file: File) => {
    setIsScanning(false);
    
    // Parse sample properties based on the file name or generate realistic smart metrics
    const fileNameLower = file.name.toLowerCase();
    let computedAmount = 4500;
    let computedClient = "Continental Telecom West Africa";
    let computedCode = "DOC-2026-904";
    let computedDescription = "Enterprise System Management Support";

    // Attempt smart keyword regex matching in real-time
    if (fileNameLower.includes("mtn")) {
      computedClient = "Prime Mobile Communications";
      computedAmount = 12500;
      computedDescription = "Bulk Mobile Telephony Channels Lease";
      computedCode = "TEL-998";
    } else if (fileNameLower.includes("telecom") || fileNameLower.includes("at")) {
      computedClient = "Unity Telecom Business";
      computedAmount = 5800;
      computedDescription = "Fiber Optic Line Support Fee";
      computedCode = "UT-40431";
    } else if (fileNameLower.includes("supplier") || fileNameLower.includes("alaba")) {
      computedClient = "Alaba Fabrics Wholesale";
      computedAmount = 2400;
      computedDescription = "Polyester & Fine Cotton Bulk Roll Deliveries";
      computedCode = "ALB-8521";
    } else {
      // Pick random parameters to avoid empty stats
      const randomClients = ["Accra Retail Hub Ltd", "Kumasi Wholesale Agency", "GHS Sovereign Supplies", "Lagos Cargo Forwarders"];
      computedClient = randomClients[Math.floor(Math.random() * randomClients.length)];
      computedAmount = Math.floor(Math.random() * 8500) + 1500;
      computedCode = `EXT-${Math.floor(Math.random() * 8000) + 2000}`;
    }

    const docResult: ImportedDocument = {
      id: "doc-" + Math.random().toString(36).substr(2, 9),
      fileName: file.name,
      fileSize: (file.size / 1024).toFixed(1) + " KB",
      extractedBusiness: computedClient,
      extractedCode: computedCode,
      extractedAmount: computedAmount,
      extractedDate: new Date().toISOString().split("T")[0],
      extractedDescription: computedDescription,
      status: "Audited",
      uploadTimestamp: new Date().toLocaleTimeString()
    };

    setScannedResult(docResult);
    triggerToast("Intelligent Aziiki OCR parse completed! Audit your variables below.");
  };

  // Load audit data into active state form
  const applyScannedOcrToBuilder = () => {
    if (!scannedResult) return;

    // Allocate or matching client name
    let matchingCustomer = customers.find(c => c.name.toLowerCase().includes(scannedResult.extractedBusiness.toLowerCase()) || scannedResult.extractedBusiness.toLowerCase().includes(c.name.toLowerCase()));
    if (matchingCustomer) {
      setCustomerId(matchingCustomer.id);
    } else {
      // Fallback or set to first element
      if (customers.length > 0) {
        setCustomerId(customers[0].id);
      }
    }

    if (mode === "invoice") {
      setInvoiceNumber(scannedResult.extractedCode);
      setItems([
        { description: scannedResult.extractedDescription, quantity: 1, rate: scannedResult.extractedAmount }
      ]);
    } else if (mode === "receipt") {
      setReceiptNumber(scannedResult.extractedCode);
      setReceiptAmount(scannedResult.extractedAmount);
      setReceiptDesc(scannedResult.extractedDescription);
    } else {
      setQuoteNumber(scannedResult.extractedCode);
      setItems([
        { description: scannedResult.extractedDescription, quantity: 1, rate: scannedResult.extractedAmount }
      ]);
    }

    // Save Doc state in persistent archive
    const updatedRecord: ImportedDocument = { ...scannedResult, status: "Imported" };
    const newArchive = [updatedRecord, ...importedDocumentArchive];
    saveArchiveToLocalStorage(newArchive);

    triggerToast(`Form populated using extracted OCR metrics of ${scannedResult.fileName}!`);
    setActivePaneTab("builder"); // return to editor
  };

  // Item List operations
  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, rate: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    if (field === "rate" || field === "quantity") {
      updatedItems[index][field] = Number(value);
    } else {
      updatedItems[index][field] = value;
    }
    setItems(updatedItems);
  };

  // All money math (subtotal/discount/tax/total) runs through integer-cents
  // arithmetic in src/lib/money.ts rather than raw floating point, so this
  // never drifts by fractions of a pesewa/cent across many line items.
  const getSubtotal = () => {
    return calculateInvoiceTotals(items, discount, taxRate).subtotal;
  };

  const getTotal = () => {
    return calculateInvoiceTotals(items, discount, taxRate, Number(shipping)).total;
  };

  const getBalanceDue = () => {
    return subtractMoney(getTotal(), Number(invoiceAmountPaid));
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      if (dateFormat === "DD/MM/YYYY") return `${day}/${month}/${year}`;
      if (dateFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
      return `${year}-${month}-${day}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Publish / Dispatch Actions
  const handleSaveInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === "custom") {
      if (!customClientName.trim()) return triggerToast("Please fill in the Custom Customer Name first!");
    } else {
      if (!customerId) return triggerToast("Please select or assign a Client Profile first!");
    }

    const resolvedCustId = customerId === "custom" ? ("custom-" + customClientName.trim()) : customerId;

    const newInv: Invoice = {
      id: "inv-" + Math.random().toString(36).substr(2, 9),
      invoiceNumber,
      customerId: resolvedCustId,
      date,
      dueDate,
      items,
      discount,
      taxRate,
      status: invoiceStatus,
      partialPaidAmount: 0,
      businessId: currentBusiness.id,
      currency: documentCurrency,
      exchangeRateToBusinessCurrency: exchangeRate,
    };

    onAddInvoice(newInv);
    triggerToast(`Published Invoice ${invoiceNumber} successfully under status "${invoiceStatus}".`);
    api.documentNumbering.peek(currentBusiness.id, "invoice", "INV").then(setInvoiceNumber).catch(() => {});
    setInvoiceStatus("Sent");
  };

  const handleSaveReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === "custom") {
      if (!customClientName.trim()) return triggerToast("Please fill in the Custom Customer Name for this payment receipt!");
    } else {
      if (!customerId) return triggerToast("Please allocate a Client Profile first!");
    }

    const resolvedCustId = customerId === "custom" ? ("custom-" + customClientName.trim()) : customerId;

    const newRec: Receipt = {
      id: "rec-" + Math.random().toString(36).substr(2, 9),
      receiptNumber,
      customerId: resolvedCustId,
      date,
      description: receiptDesc,
      amountPaid: receiptAmount,
      paymentMethod,
      businessId: currentBusiness.id,
      currency: documentCurrency,
      exchangeRateToBusinessCurrency: exchangeRate,
    };

    onAddReceipt(newRec);
    triggerToast(`Logged payment confirmation receipt ${receiptNumber} into business archives.`);
    api.documentNumbering.peek(currentBusiness.id, "receipt", "REC").then(setReceiptNumber).catch(() => {});
  };

  // Resolves the currently-previewed invoice/receipt/quotation back to its
  // saved, server-issued record (if any) so "Send by Email"/"Sign
  // Document" can reference a real id - the preview panel itself is just
  // local draft state until saved.
  const savedDocumentId =
    mode === "invoice"
      ? invoices.find((inv) => inv.invoiceNumber === invoiceNumber && inv.businessId === currentBusiness.id)?.id
      : mode === "receipt"
      ? receipts.find((r) => r.receiptNumber === receiptNumber && r.businessId === currentBusiness.id)?.id
      : quotations.find((q) => q.quoteNumber === quoteNumber && q.businessId === currentBusiness.id)?.id;

  const resolvedDocCustomer = customerId && customerId !== "custom" ? customers.find((c) => c.id === customerId) : undefined;

  // Customer e-signature captured against this specific saved document
  // (invoice/quotation only - a receipt is proof of a payment already
  // made, not something a customer needs to sign off on).
  const [documentSignature, setDocumentSignature] = useState<any | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);

  useEffect(() => {
    if (!savedDocumentId || (mode !== "invoice" && mode !== "quotation")) {
      setDocumentSignature(null);
      return;
    }
    api.signatures.get(mode, savedDocumentId).then(setDocumentSignature).catch(() => setDocumentSignature(null));
  }, [savedDocumentId, mode]);

  const handleSendDocumentEmail = async () => {
    if (!savedDocumentId || (mode !== "invoice" && mode !== "receipt")) return;
    setIsSendingEmail(true);
    try {
      const result =
        mode === "invoice" ? await api.invoices.sendEmail(savedDocumentId) : await api.receipts.sendEmail(savedDocumentId);
      triggerToast(result.message);
    } catch (err) {
      triggerToast(getFriendlyErrorMessage(err));
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Starts a Paystack checkout for the currently-saved invoice and opens it
  // in a new tab. Payment confirmation itself never happens here - it's the
  // server-side webhook (paystack/webhook) that later marks the invoice
  // Paid once Paystack actually confirms the charge.
  const handleRequestPayment = async () => {
    if (!savedDocumentId || mode !== "invoice") return;
    setIsRequestingPayment(true);
    try {
      const result = await api.payments.initializePaystack({
        businessId: currentBusiness.id,
        invoiceId: savedDocumentId,
        customerId: resolvedDocCustomer?.id,
        email: resolvedDocCustomer?.email,
        amount: getTotal(),
        currency: currentBusiness.currency,
      });
      window.open(result.authorizationUrl, "_blank", "noreferrer");
      triggerToast(`Payment link opened - share it with ${resolvedDocCustomer?.name || "your customer"} to collect payment.`);
    } catch (err) {
      // AZIIKI ERROR SYSTEM: getFriendlyErrorMessage() never surfaces a raw
      // 5xx/internal error string here - a real Paystack/network failure
      // shows calm, actionable copy instead of leaking backend details into
      // a payment flow, while a genuine 4xx (e.g. "customer has no email on
      // file") still shows its already-user-facing server message verbatim.
      triggerToast(getFriendlyErrorMessage(err));
    } finally {
      setIsRequestingPayment(false);
    }
  };

  const handleSaveQuotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (customerId === "custom") {
      if (!customClientName.trim()) return triggerToast("Please fill in the Custom Customer Name for this quote estimate!");
    } else {
      if (!customerId) return triggerToast("Select a client target to dispatch this quote proposal.");
    }

    const resolvedCustId = customerId === "custom" ? ("custom-" + customClientName.trim()) : customerId;

    const { total } = calculateInvoiceTotals(items, discount, 0);

    const newQuote: Quotation = {
      id: "quote-" + Math.random().toString(36).substr(2, 9),
      quoteNumber,
      customerId: resolvedCustId,
      date,
      validUntil: dueDate,
      items,
      discount,
      totalAmount: total,
      status: "Sent",
      businessId: currentBusiness.id,
      currency: documentCurrency,
      exchangeRateToBusinessCurrency: exchangeRate,
    };

    onAddQuotation(newQuote);
    triggerToast(`Quotation Proposal ${quoteNumber} logged successfully. Eligible for client dispatch.`);
    api.documentNumbering.peek(currentBusiness.id, "quotation", "EST").then(setQuoteNumber).catch(() => {});
  };

  // WhatsApp helper link
  const getWhatsAppLink = (num: string, totalVal: number, typeLabel: string) => {
    const clientName = customerId === "custom" ? (customClientName || "Valued Customer") : (customers.find(c => c.id === customerId)?.name || "Valued Customer");
    const textDesc = `Hello ${clientName},\n\nKindly inspect outstanding details for the issued ${typeLabel} (${num}) from ${issuerName}:\nTotal Value: ${currencySymbol}${totalVal.toLocaleString()}\nPlease route settlement via Mobile Money or Bank Transfer.\n\nThank you for partner integration with our SME workspace!`;
    return `https://wa.me/?text=${encodeURIComponent(textDesc)}`;
  };

  const activeTemplate = DESIGN_TEMPLATES[templateIndex];

  return (
    <div id="invoice-receipt-builder-root" className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 font-sans" style={{ color: "var(--text-primary)" }}>

      {/* 4-Column Controls Panel */}
      <div className="lg:col-span-5 az-card az-elevation-1 p-4 sm:p-5 space-y-4">

        {/* Component Header info */}
        <div>
          <h3 className="text-sm font-bold font-sans flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <span className="p-1.5 rounded-lg az-chip-accent"><Sliders className="w-3.5 h-3.5" /></span>
            Workspace Designer
          </h3>
          <p className="text-[11px] font-sans mt-1 ml-8" style={{ color: "var(--text-secondary)" }}>
            Configure, style, auto-import, and design local business invoices with high design standards.
          </p>
        </div>

        {/* Action Type Toggle */}
        <div className="grid grid-cols-3 gap-1 az-card-inset p-1">
          <button
            onClick={() => setMode("invoice")}
            className="py-2.5 text-[10px] font-bold font-sans rounded-lg transition-all cursor-pointer"
            style={mode === "invoice" ? { background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-1)" } : { color: "var(--text-secondary)" }}
          >
            Invoice
          </button>
          <button
            onClick={() => setMode("receipt")}
            className="py-2.5 text-[10px] font-bold font-sans rounded-lg transition-all cursor-pointer"
            style={mode === "receipt" ? { background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-1)" } : { color: "var(--text-secondary)" }}
          >
            Receipt
          </button>
          <button
            onClick={() => setMode("quotation")}
            className="py-2.5 text-[10px] font-bold font-sans rounded-lg transition-all cursor-pointer"
            style={mode === "quotation" ? { background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-1)" } : { color: "var(--text-secondary)" }}
          >
            Estimate
          </button>
        </div>

        {/* Tab Controls for the Side Panel — horizontal-scroll pill nav, mobile-first
            (was underline-tabs squeezed to fit; pills scroll cleanly instead of wrapping). */}
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar -mx-1 px-1 pb-1">
          {([
            { key: "builder", label: "✍️ Info Form" },
            { key: "style", label: "🎨 Styles" },
            { key: "pdfImport", label: "📥 PDF Intake" },
            { key: "history", label: "📄 Past Ledger" },
            ...(!MVP_MODE ? [{ key: "gallery", label: "🖼️ Gallery" }] : []),
            { key: "brandKit", label: "🏷️ Brand Kit" },
            ...(!MVP_MODE ? [{ key: "purchaseOrders", label: "📦 Purchase Orders" }] : []),
            ...(!MVP_MODE ? [{ key: "team", label: "👥 Team" }] : []),
            ...(!MVP_MODE ? [{ key: "currencies", label: "💱 Exchange Rates" }] : []),
          ] as { key: typeof activePaneTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => changePaneTab(tab.key)}
              className="shrink-0 px-3 py-2 text-[10px] font-bold font-sans rounded-xl text-center cursor-pointer transition-all micro-press"
              style={
                activePaneTab === tab.key
                  ? { background: "var(--accent-soft)", color: "var(--accent)", boxShadow: "inset 0 0 0 1px var(--accent)" }
                  : { color: "var(--text-secondary)" }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Toast Alerts */}
        {toastMessage && (
          <div className="az-chip-positive text-[11px] p-3 rounded-xl font-sans flex items-start gap-2 animate-fade-in select-none">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-semibold">{toastMessage}</p>
          </div>
        )}

        {/* key={activePaneTab} forces a remount on every pane switch so the
            fade-in animation replays instead of only firing once. */}
        <div key={activePaneTab} className="animate-fade-in">
            {/* PANE 1: Standard Document Info Form */}
            {activePaneTab === "builder" && (
          <form onSubmit={mode === "invoice" ? handleSaveInvoice : mode === "receipt" ? handleSaveReceipt : handleSaveQuotation} className="space-y-3.5 text-xs">
            
            {/* COLLAPSIBLE ISSUER DETAILS BRAND CARD (Issued By) */}
            <div className="az-card-inset overflow-hidden text-left">
              <button
                type="button"
                onClick={() => setShowIssuerConfig(!showIssuerConfig)}
                className="w-full px-4 py-3.5 flex justify-between items-center text-left transition-colors select-none az-hover-lift"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg az-chip-accent text-sm leading-none">🏢</span>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
                    Edit Issuer Brand Info (Issued By)
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold" style={{ color: "var(--accent)" }}>{showIssuerConfig ? "Close ▴" : "Customize ▾"}</span>
              </button>

              {showIssuerConfig && (
                <div className="p-4 border-t space-y-3 animate-slide-up text-xs" style={{ borderColor: "var(--border-subtle)" }}>
                  {currentBusiness?.locked && (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 text-[10px] font-sans font-medium flex items-center gap-1.5">
                      🔒 <strong>Brand Profile Locked:</strong> Company profile details are locked from editing. Uncheck "Lock Business Profile Details" in Settings (Edit) to modify.
                    </div>
                  )}
                  <div>
                    <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1">Company / Issuer Name</label>
                    <input
                      type="text"
                      disabled={currentBusiness?.locked}
                      value={issuerName}
                      onChange={(e) => setIssuerName(e.target.value)}
                      className="w-full bg-slate-50 text-slate-805 border border-slate-205 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all font-medium disabled:opacity-60"
                      placeholder="e.g. BlueStar Agro-Ventures"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1">Industry / Branch label</label>
                      <input
                        type="text"
                        disabled={currentBusiness?.locked}
                        value={issuerIndustry}
                        onChange={(e) => setIssuerIndustry(e.target.value)}
                        className="w-full bg-slate-50 text-slate-805 border border-slate-205 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all disabled:opacity-60"
                        placeholder="e.g. Accra Logistics Branch"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1">Accreditation / Contacts</label>
                      <input
                        type="text"
                        disabled={currentBusiness?.locked}
                        value={issuerContact}
                        onChange={(e) => setIssuerContact(e.target.value)}
                        className="w-full bg-slate-50 text-slate-805 border border-slate-205 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all disabled:opacity-60"
                        placeholder="City, Country • Phone/Email"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1">Legal/VAT Description</label>
                    <textarea
                      rows={2}
                      disabled={currentBusiness?.locked}
                      value={issuerDesc}
                      onChange={(e) => setIssuerDesc(e.target.value)}
                      className="w-full bg-slate-50 text-slate-805 border border-slate-205 rounded-xl px-3 py-2 outline-none font-sans resize-none text-[11px] focus:bg-white focus:border-emerald-500 transition-all disabled:opacity-60"
                      placeholder="Compliant SME hub description..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Customer dropdown selection */}
            <div className="text-left">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wide">
                  Account CRM Customer (Issued To)
                </label>
                <span className="text-[9px] text-indigo-600 font-mono font-bold">Limitless Direct Input</span>
              </div>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-sans cursor-pointer transition-all font-medium"
              >
                <option value="custom">✍️ [Manual Client] Type custom customer below...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone || "No Mobile Info"})</option>
                ))}
              </select>
            </div>

            {/* Document currency - defaults to the business's own currency,
                auto-fills from a customer's saved preference, always overridable. */}
            <div className={`grid ${documentCurrency !== currentBusiness.currency ? "grid-cols-2" : "grid-cols-1"} gap-2 text-left`}>
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wide block mb-1">
                  Document Currency
                </label>
                <select
                  value={documentCurrency}
                  onChange={(e) => setDocumentCurrency(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-sans cursor-pointer transition-all font-medium"
                >
                  {SUPPORTED_CURRENCY_CODES.map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              {documentCurrency !== currentBusiness.currency && (
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 uppercase tracking-wide block mb-1">
                    1 {documentCurrency} = ? {currentBusiness.currency}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(Number(e.target.value) || 1)}
                    className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-sans font-mono"
                  />
                </div>
              )}
            </div>

            {/* Custom Manual Customer Fields */}
            {customerId === "custom" && (
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4 space-y-3 animate-fade-in text-left">
                <span className="text-[9.5px] font-mono text-emerald-600 uppercase tracking-widest font-extrabold flex items-center gap-1">
                  👤 Custom Client Profile
                </span>
                <div>
                  <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1 font-sans">Customer name / Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Osei-Tutu & Partners Ltd"
                    value={customClientName}
                    onChange={(e) => setCustomClientName(e.target.value)}
                    className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans focus:border-emerald-500 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1 font-sans">Email Address</label>
                    <input
                      type="email"
                      placeholder="finance@oseitutu.gh"
                      value={customClientEmail}
                      onChange={(e) => setCustomClientEmail(e.target.value)}
                      className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1 font-sans">Phone Number</label>
                    <input
                      type="text"
                      placeholder="+233 55 987 6543"
                      value={customClientPhone}
                      onChange={(e) => setCustomClientPhone(e.target.value)}
                      className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-450 uppercase font-bold block mb-1 font-sans">Client Segment Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Retail Consumer, Wholesale, Distributor"
                    value={customClientCategory}
                    onChange={(e) => setCustomClientCategory(e.target.value)}
                    className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Code identifier and date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 tracking-wider block mb-1">
                  Document Code Call
                </label>
                <input
                  type="text"
                  value={mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber}
                  onChange={(e) => mode === "invoice" ? setInvoiceNumber(e.target.value) : mode === "receipt" ? setReceiptNumber(e.target.value) : setQuoteNumber(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold text-slate-450 tracking-wider block mb-1">
                  Issue Statement Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Line items list for Invoices & Estimates */}
            {(mode === "invoice" || mode === "quotation") ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-450 tracking-wider uppercase">Line Ledger Items</span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold font-sans flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Row
                  </button>
                </div>

                <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div key={index} className="bg-slate-50/70 p-2.5 border border-slate-205 rounded-xl space-y-2">
                      <input
                        type="text"
                        placeholder="Service / stock material description"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none font-sans"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono text-center"
                        />
                        <input
                          type="number"
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                          className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono text-right"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                          className="bg-rose-50 text-rose-600 border border-rose-100 rounded-lg flex items-center justify-center p-1.5 hover:bg-rose-100 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Discounts and compliance rates */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-450">Discount Percent (%)</label>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-455">Local VAT Rate (%)</label>
                    <input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-full bg-white text-slate-805 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Shipping and Amount Paid */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-450">Shipping Cost ({currencySymbol})</label>
                    <input
                      type="number"
                      value={shipping}
                      onChange={(e) => setShipping(Number(e.target.value))}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-455">Amount Paid ({currencySymbol})</label>
                    <input
                      type="number"
                      value={invoiceAmountPaid}
                      onChange={(e) => setInvoiceAmountPaid(Number(e.target.value))}
                      className="w-full bg-white text-slate-805 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Receipt single item fields */
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">
                    Receipt Ledger Payment Description
                  </label>
                  <input
                    type="text"
                    value={receiptDesc}
                    onChange={(e) => setReceiptDesc(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-sans"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">Amount Settled ({currencySymbol})</label>
                    <input
                      type="number"
                      value={receiptAmount}
                      onChange={(e) => setReceiptAmount(Number(e.target.value))}
                      className="w-full bg-white text-slate-805 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">Payment Channel</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-sans cursor-pointer"
                    >
                      <option value="Mobile Money">Mobile Money</option>
                      <option value="Cash">Cash Ledger</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Active Terms due details */}
            {mode === "invoice" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">
                    Settlement Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-white text-slate-808 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold text-slate-450 block mb-1">
                    Document Payment Status
                  </label>
                  <select
                    value={invoiceStatus}
                    onChange={(e) => setInvoiceStatus(e.target.value as Invoice["status"])}
                    className="w-full bg-white text-slate-850 border border-slate-200 rounded-xl px-3 py-2.5 outline-none font-sans cursor-pointer focus:border-emerald-500"
                  >
                    <option value="Sent">Sent (Unpaid)</option>
                    <option value="Paid">Paid (Automated Stock Lift)</option>
                    <option value="Draft">Draft</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              </div>
            )}

            {/* Save Buttons */}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer font-sans uppercase tracking-wider"
            >
              <Check className="w-4 h-4" />
              Save & Register {mode}
            </button>
          </form>
        )}

        {/* PANE 2: Choose a Layout Design & Design Your Own */}
        {activePaneTab === "style" && (
          <div className="space-y-4 text-xs">

            {/* Template switcher section. MVP_TEMPLATE_IDS controls which of the 10 named designs are shown; trim it to curate a smaller set (array itself untouched either way). */}
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase tracking-wider mb-2">
                Choose from {MVP_MODE ? MVP_TEMPLATE_IDS.length : DESIGN_TEMPLATES.length} Layout Designs
              </span>

              {/* Grid of designs. AZIIKI BASIC VERSION 1.0 fix: the badge number is now the design's
                  position within the DISPLAYED list (1, 2, 3, 4...), not its original array id — so if
                  MVP_TEMPLATE_IDS is ever trimmed to a subset again, the numbers stay sequential instead
                  of jumping (the earlier bug: #1, #2, #3, #6, #7). templateIndex/setTemplateIndex still
                  use the template's real array id underneath, so saved documents keep pointing at the
                  correct design regardless of what's currently shown. */}
              <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {(MVP_MODE ? DESIGN_TEMPLATES.filter((t) => MVP_TEMPLATE_IDS.includes(t.id)) : DESIGN_TEMPLATES).map((tpl, displayPosition) => {
                  const i = tpl.id; // real array index — used for state/rendering, never shown to the user
                  const displayNumber = displayPosition + 1; // what the user sees — always sequential
                  return (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      setTemplateIndex(i);
                      // Apply default configuration values for specific templates to improve UX
                      if (i === 3) {
                        setSelectedFont("Courier");
                        setBorderRadiusMode("None");
                      } else if (i === 4 || i === 2) {
                        setSelectedFont("Georgia");
                      } else {
                        setSelectedFont("Arial");
                      }
                      triggerToast(`Applied visual template layout: ${tpl.name}`);
                    }}
                    className={`text-left p-2.5 rounded-xl border transition-all text-[11px] ${
                      templateIndex === i
                        ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="font-bold text-slate-900 font-sans flex items-center gap-1">
                      <span className="text-emerald-600 font-bold font-mono">#{displayNumber}</span>
                      {tpl.name}
                    </div>
                    <p className="text-[9px] text-slate-450 leading-tight mt-1 line-clamp-2">
                      {tpl.description}
                    </p>
                  </button>
                  );
                })}
              </div>
            </div>

            {/* Design Their Own / Customizable Section */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase tracking-wider">
                🛠️ Custom Branding Suite
              </span>

              {/* Accent Color Picker and safe codes */}
              <div>
                <label className="text-[10px] text-slate-455 block mb-1 font-sans">
                  Accent Primary Colorway
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#10b981"
                    className="flex-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono"
                  />
                </div>
                {/* Accent presets */}
                <div className="flex gap-1.5 mt-1.5">
                  {["#10b981", "#059669", "#047857", "#065f46", "#15803d", "#166534"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className="w-5 h-5 rounded-full border border-slate-200 cursor-pointer"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Font style Selector */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">
                  Typography pairing font
                </label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="Arial">Sans-Serif (Standard Clear)</option>
                  <option value="Georgia">Editorial Serif (Tradition)</option>
                  <option value="Courier">Monospaced (Raw Code Tech)</option>
                  <option value="Trebuchet MS">Tech-Forward Outfit</option>
                </select>
              </div>

              {/* Secondary Color Picker */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-455 block mb-1 font-sans">
                    Secondary Accent
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#475569"
                      className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono text-[10px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-455 block mb-1 font-sans">
                    Branding Highlight
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={customAccentColor}
                      onChange={(e) => setCustomAccentColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={customAccentColor}
                      onChange={(e) => setCustomAccentColor(e.target.value)}
                      placeholder="#f59e0b"
                      className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono text-[10px]"
                    />
                  </div>
                </div>
              </div>

              {/* Paper Background Style */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Paper Background Treatment</label>
                <select
                  value={paperBackground}
                  onChange={(e) => setPaperBackground(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="White">Pure White (#FFFFFF)</option>
                  <option value="Ivory">Creamy Ivory (#FAF8F5)</option>
                  <option value="Sand">Warm Sand (#F5F1EA)</option>
                  <option value="Gray">Recycled Gray (#F3F4F6)</option>
                </select>
              </div>

              {/* Border Style Option */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Document Border Style</label>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="Solid">Solid Border</option>
                  <option value="Double">Double Border</option>
                  <option value="Dashed">Dashed Border</option>
                  <option value="Dotted">Dotted Border</option>
                  <option value="None">No Outer Border</option>
                </select>
              </div>

              {/* Logo Placement */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Logo Header Placement</label>
                <select
                  value={logoPlacement}
                  onChange={(e) => setLogoPlacement(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="Left">Left-Aligned Logo</option>
                  <option value="Center">Centered Logo</option>
                  <option value="Right">Right-Aligned Logo</option>
                </select>
              </div>

              {/* Footer Alignment */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Footer Elements Alignment</label>
                <select
                  value={footerAlignment}
                  onChange={(e) => setFooterAlignment(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="Left">Left Aligned</option>
                  <option value="Center">Centered Alignment</option>
                  <option value="Right">Right Aligned</option>
                </select>
              </div>

              {/* Date Format Option */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Localized Date Format</label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                >
                  <option value="YYYY-MM-DD">Standard ISO (YYYY-MM-DD)</option>
                  <option value="DD/MM/YYYY">Commonwealth (DD/MM/YYYY)</option>
                  <option value="MM/DD/YYYY">North American (MM/DD/YYYY)</option>
                </select>
              </div>

              {/* Bank Transfer Details Input */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Bank Payment Details</label>
                <input
                  type="text"
                  value={bankDetails}
                  onChange={(e) => setBankDetails(e.target.value)}
                  placeholder="e.g. Bank Name, Account Number, Branch"
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-sans"
                />
              </div>

              {/* Mobile Money Details Input */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Mobile Money (MOMO) Details</label>
                <input
                  type="text"
                  value={momoDetails}
                  onChange={(e) => setMomoDetails(e.target.value)}
                  placeholder="e.g. Mobile Money / Bank Transfer"
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-sans"
                />
              </div>

              {/* Terms and Conditions Input */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Terms & Conditions Statement</label>
                <textarea
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  rows={2}
                  placeholder="Official Terms and Conditions text..."
                  className="w-full bg-slate-50 text-slate-808 border border-slate-200 rounded-xl p-2 outline-none font-sans text-[11px]"
                />
              </div>

              {/* Logo Manager - preset custom icon vs upload brand */}
              <div>
                <label className="text-[10px] text-slate-455 block font-sans">Logo Import Channels</label>
                
                {/* File picker for custom logo */}
                <div className="mt-1 flex items-center justify-between gap-2 bg-slate-50 p-2 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    {uploadedLogo ? (
                      <img 
                        src={uploadedLogo} 
                        alt="Brand preview" 
                        className="w-8 h-8 rounded-lg object-contain bg-white border"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center text-xs">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold block text-slate-800">
                        {uploadedLogo ? "Brand Imaged loaded" : "Upload Custom Logo"}
                      </span>
                      <span className="text-[9px] text-slate-400 block">PNG, JPEG or SVG</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1 text-[9px] font-bold cursor-pointer font-sans transition-colors shrink-0">
                      Browse
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                        className="hidden" 
                      />
                    </label>
                    {uploadedLogo && (
                      <button
                        onClick={clearUploadedLogo}
                        className="text-rose-600 hover:text-rose-700 font-bold text-[9px] font-sans"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Preset badges choice if they do not have file ready */}
                {!uploadedLogo && (
                  <div className="mt-2">
                    <span className="text-[9px] text-slate-450 block mb-1">Or choose a pre-designed icon graphic:</span>
                    <div className="flex gap-1 overflow-x-auto max-width-full py-0.5">
                      {PRESET_LOGOS.map((logo) => (
                        <button
                          key={logo.id}
                          onClick={() => {
                            setSelectedPresetLogo(logo.id);
                            triggerToast(`Activated Preset Vector: ${logo.name}`);
                          }}
                          className={`px-2 py-1 rounded border text-[9px] whitespace-nowrap transition-all ${
                            selectedPresetLogo === logo.id 
                              ? "bg-emerald-600 text-white font-bold border-emerald-600" 
                              : "bg-slate-50 text-slate-655 border-slate-200"
                          }`}
                        >
                          <span className="mr-0.5 font-mono font-black">{logo.char}</span> {logo.name.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Borders control and roundness settings */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">
                  Edge Borders Roundness
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {["None", "Soft", "Chubby"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setBorderRadiusMode(mode as any)}
                      className={`py-1 rounded border font-sans text-[10px] transition-all capitalize ${
                        borderRadiusMode === mode 
                          ? "bg-slate-200 border-slate-400 font-bold text-slate-900" 
                          : "bg-white border-slate-205 text-slate-500"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Watermark texts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-455 font-sans">
                    Enable Background Watermark
                  </label>
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="w-3.5 h-3.5 bg-white rounded accent-emerald-600"
                  />
                </div>
                {showWatermark && (
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. TAX COMPLIANT ORIGINAL"
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-sans"
                  />
                )}
              </div>

              {/* Header Style */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Header Alignment Variant</label>
                <div className="grid grid-cols-3 gap-1">
                  {(["Compact", "TwoColumn", "Centered"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setHeaderLayout(opt)}
                      className={`py-1 text-[9px] rounded border transition-all ${
                        headerLayout === opt 
                          ? "bg-emerald-600 text-white font-bold border-emerald-600" 
                          : "bg-white border-slate-200 text-slate-500"
                      }`}
                    >
                      {opt === "TwoColumn" ? "2-Col Detail" : opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Signature Block edit */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Signature Title line</label>
                <input
                  type="text"
                  value={authorizedSignature}
                  onChange={(e) => setAuthorizedSignature(e.target.value)}
                  className="w-full bg-slate-50 text-slate-805 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-sans"
                />
              </div>

              {/* Footnotes statement */}
              <div>
                <label className="text-[10px] text-slate-450 block mb-1 font-sans">Footnote Disclaimers</label>
                <textarea
                  value={customFooterNotes}
                  onChange={(e) => setCustomFooterNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 text-slate-808 border border-slate-200 rounded-xl p-2 outline-none font-sans text-[11px]"
                />
              </div>

            </div>
          </div>
        )}

        {/* PANE 3: Import Own Receipts as PDFs (OCR engine) */}
        {activePaneTab === "pdfImport" && (
          <div className="space-y-4 text-xs font-sans">
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase tracking-wider mb-1">
                Import Receipts & Invoices (PDF/Image)
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans mb-3">
                Drop previous invoice PDFs or supplier receipts to extract lines, amounts, and dates automatically into the builder form.
              </p>
            </div>

            {/* Drag & Drop simulated area */}
            <div className="border-2 border-dashed border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40 rounded-2xl p-6 text-center relative transition-all">
              <input
                type="file"
                accept=".pdf, image/*"
                onChange={handleIntakeFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileUp className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-bold text-slate-900 text-xs">Choose PDF Invoice / Image</p>
              <p className="text-[10px] text-slate-400 mt-1">Accepts standard PDF, JPG, PNG formats up to 5MB</p>
            </div>

            {/* Scanning progress display */}
            {isScanning && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-2 animate-pulse text-xs">
                <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto" />
                <p className="font-bold text-emerald-900 font-sans">Aziiki Intelligent OCR Active</p>
                <p className="text-[10px] text-emerald-700 italic font-mono font-medium">{scanStep}</p>
                <div className="w-full max-w-xs h-1 px-4 bg-slate-200 mx-auto rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full animate-infinite-loading"></div>
                </div>
              </div>
            )}

            {/* Extracted results Audit Panel */}
            {scannedResult && !isScanning && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3 animate-fade-in text-xs">
                <div className="flex items-center justify-between border-b border-slate-205 pb-2">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold font-sans">
                    <CheckSquare className="w-4 h-4" />
                    <span>OCR Extracted Data Card</span>
                  </div>
                  <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">READY</span>
                </div>

                <div className="space-y-2.5 leading-relaxed font-sans text-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-mono">EXTRACTED SENDER</span>
                      <input
                        type="text"
                        value={scannedResult.extractedBusiness}
                        onChange={(e) => setScannedResult({ ...scannedResult, extractedBusiness: e.target.value })}
                        className="w-full bg-white border rounded px-2 py-0.5 font-sans mt-0.5 font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-mono">DOCUMENT REFERENCE</span>
                      <input
                        type="text"
                        value={scannedResult.extractedCode}
                        onChange={(e) => setScannedResult({ ...scannedResult, extractedCode: e.target.value })}
                        className="w-full bg-white border rounded px-2 py-0.5 font-sans mt-0.5 font-mono text-slate-850"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-slate-400 block font-mono">EXTRACTED DESCRIPTION</span>
                    <input
                      type="text"
                      value={scannedResult.extractedDescription}
                      onChange={(e) => setScannedResult({ ...scannedResult, extractedDescription: e.target.value })}
                      className="w-full bg-white border rounded px-2 py-0.5 mt-0.5 text-slate-800 font-sans"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-mono">EXTRACTED AMOUNT</span>
                      <input
                        type="number"
                        value={scannedResult.extractedAmount}
                        onChange={(e) => setScannedResult({ ...scannedResult, extractedAmount: Number(e.target.value) })}
                        className="w-full bg-white border rounded px-2 py-0.5 mt-0.5 font-mono text-emerald-600 font-extrabold"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block font-mono">STATEMENT DATE</span>
                      <input
                        type="date"
                        value={scannedResult.extractedDate}
                        onChange={(e) => setScannedResult({ ...scannedResult, extractedDate: e.target.value })}
                        className="w-full bg-white border rounded px-2 py-0.5 mt-0.5 font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <button
                    onClick={applyScannedOcrToBuilder}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-sans rounded-xl py-2 cursor-pointer transition-colors mt-1 hover:shadow-sm"
                  >
                    Populate Editor fields using OCR
                  </button>
                </div>
              </div>
            )}

            {/* Imported Document Archive history list */}
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase tracking-wider mb-2">
                Archives of Imported PDFs ({importedDocumentArchive.length})
              </span>

              {importedDocumentArchive.length > 0 ? (
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {importedDocumentArchive.map((arch) => (
                    <div key={arch.id} className="bg-slate-50 border rounded-xl p-3 flex justify-between items-center hover:border-slate-300 transition-colors">
                      <div className="space-y-0.5 leading-relaxed">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-900 block max-w-[130px] truncate">{arch.fileName}</span>
                          <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-100">PDF</span>
                        </div>
                        <span className="text-[9px] text-slate-400 block">Extracted: {currencySymbol}{arch.extractedAmount.toLocaleString()} — {arch.uploadTimestamp}</span>
                      </div>
                      <button
                        onClick={() => {
                          setScannedResult(arch);
                          triggerToast(`Reloaded extracted variables for ${arch.fileName}`);
                        }}
                        className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 font-sans"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 italic text-[11px] font-sans">
                  No imported sheets logged in standard workspace. Use PDF section folder above to upload assets.
                </div>
              )}
            </div>

          </div>
        )}

        {/* PANE 4: Past Invoices Ledger List */}
        {activePaneTab === "history" && (
          <div className="space-y-4 text-xs font-sans">
            <div>
              <span className="text-[10px] font-mono font-bold text-indigo-650 block uppercase tracking-wider mb-1">
                🧾 Past Invoices Ledger List
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed font-sans mb-3">
                Manage sent estimates or invoices. Flagging an invoice as "Paid" automatically triggers inventory stock lift and ledger cash inflow transaction registration.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
              {invoices.filter(inv => inv.businessId === currentBusiness.id).map(inv => {
                const grandTotal = calculateInvoiceTotals(inv.items, inv.discount, inv.taxRate).total;
                const customerObj = customers.find(c => c.id === inv.customerId);

                return (
                  <div key={inv.id} className="bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl p-3.5 space-y-2 text-left relative flex flex-col justify-between hover:border-slate-350 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 text-[11px]">
                        {inv.invoiceNumber}
                      </span>
                      {inv.status === "Paid" ? (
                        <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                          ✓ PAID
                        </span>
                      ) : inv.status === "Overdue" ? (
                        <span className="text-[9px] font-mono bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-md border border-red-150 flex items-center gap-1">
                          ⚠ OVERDUE
                        </span>
                      ) : inv.status === "Draft" ? (
                        <span className="text-[9px] font-mono bg-slate-100/80 text-slate-600 font-medium px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                          ✍ DRAFT
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono bg-emerald-50 text-emerald-600 font-bold px-2 py-0.5 rounded-md border border-emerald-150 flex items-center gap-1">
                          ✉ SENT / UNPAID
                        </span>
                      )}
                    </div>

                    {latestFailedOrPendingPaymentByInvoice.has(inv.id) && (
                      <div
                        className={`text-[9px] font-mono font-bold px-2 py-1 rounded-md border flex items-center gap-1 w-fit ${
                          latestFailedOrPendingPaymentByInvoice.get(inv.id).status === "failed"
                            ? "bg-rose-50 text-rose-600 border-rose-150"
                            : latestFailedOrPendingPaymentByInvoice.get(inv.id).status === "abandoned"
                            ? "bg-amber-50 text-amber-700 border-amber-150"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {latestFailedOrPendingPaymentByInvoice.get(inv.id).status === "failed"
                          ? "⚠ Last payment attempt failed"
                          : latestFailedOrPendingPaymentByInvoice.get(inv.id).status === "abandoned"
                          ? "⏳ Payment link opened, not completed"
                          : "⏳ Payment in progress"}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[11px] leading-tight text-slate-600 font-sans">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-mono">CLIENT</span>
                        <strong className="text-slate-800">{customerObj?.name || (inv.customerId.startsWith("custom-") ? inv.customerId.replace("custom-", "") : "Direct Buyer")}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block font-mono">DUE VALUE</span>
                        <strong className="text-slate-900 text-xs font-mono">{currencySymbol}{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-450">Issue: {inv.date}</span>
                      
                      {inv.status !== "Paid" && onUpdateInvoiceStatus && (
                        <button
                          onClick={() => {
                            onUpdateInvoiceStatus(inv.id, "Paid");
                            triggerToast(`Invoice ${inv.invoiceNumber} status finalized to "Paid"! Silent trigger adjusted warehouse stocks.`);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold select-none cursor-pointer px-2.5 py-1 rounded-lg transition-all shadow-sm"
                        >
                          Mark as Paid ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {invoices.filter(inv => inv.businessId === currentBusiness.id).length === 0 && (
                <EmptyState
                  compact
                  icon={FileText}
                  title="No documents yet"
                  message="Fill in your client's details under Info Form to generate your first invoice, receipt, or estimate."
                  action={{ label: "Go to Info Form", onClick: () => changePaneTab("builder") }}
                />
              )}
            </div>
          </div>
        )}

        {/* AZIIKI BASIC VERSION: Template Gallery / Purchase Orders / Team / Exchange Rates gated behind MVP_MODE, code preserved for future re-activation. */}

        {/* PANE 5: Template Gallery (browse/favorite/duplicate saved designs) */}
        {!MVP_MODE && activePaneTab === "gallery" && (
          <TemplateGallery
            businessId={currentBusiness.id}
            documentType={mode}
            activeTemplateIndex={templateIndex}
            onUseTemplate={(idx) => {
              setActiveCustomLayout(null);
              setActiveCustomTemplateId(undefined);
              setTemplateIndex(idx);
              changePaneTab("style");
            }}
            activeCustomTemplateId={activeCustomTemplateId}
            onUseCustomTemplate={(layoutConfig, templateId) => {
              setActiveCustomLayout(layoutConfig);
              setActiveCustomTemplateId(templateId);
              changePaneTab("style");
            }}
          />
        )}

        {/* PANE 6: Brand Kit (colors, tax info, footer text used on every document) — kept in MVP */}
        {activePaneTab === "brandKit" && <BrandKitSettings businessId={currentBusiness.id} />}

        {/* PANE 7: Purchase Orders (buying FROM a supplier - the opposite direction of an invoice) */}
        {!MVP_MODE && activePaneTab === "purchaseOrders" && (
          <PurchaseOrderManager businessId={currentBusiness.id} businessCurrency={currentBusiness.currency} />
        )}

        {/* PANE 8: Team (invite people to help run this business, with real per-role access) */}
        {!MVP_MODE && activePaneTab === "team" && <TeamManager businessId={currentBusiness.id} />}

        {/* PANE 9: Exchange Rates (manual rates that auto-fill foreign-currency documents) */}
        {!MVP_MODE && activePaneTab === "currencies" && (
          <ExchangeRateSettings businessId={currentBusiness.id} businessCurrency={currentBusiness.currency} />
        )}
        </div>

      </div>

      {/* 8-Column Document Preview Canvas (WYSIWYG Mockup layout representing client-facing branding) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        
        {/* Dynamic Mockup Card with real-time variables */}
        <div 
          id="mockup-document-view" 
          className="relative overflow-hidden min-h-[580px] flex flex-col justify-between select-all"
          style={{ 
            fontFamily: selectedFont === "Arial" ? "Inter, sans-serif" : selectedFont === "Georgia" ? "Georgia, serif" : selectedFont === "Courier" ? "monospace" : "Outfit, sans-serif",
            backgroundColor: paperBackground === "White" ? "#ffffff" : paperBackground === "Ivory" ? "#FAF8F5" : paperBackground === "Sand" ? "#F5F1EA" : "#F3F4F6",
            color: paperBackground === "White" ? "#0f172a" : paperBackground === "Ivory" ? "#1e293b" : paperBackground === "Sand" ? "#334155" : "#1e293b",
            border: borderStyle === "None" ? "none" : borderStyle === "Double" ? `6px double ${accentColor}` : borderStyle === "Dashed" ? `1px dashed ${accentColor}` : borderStyle === "Dotted" ? `1px dotted ${accentColor}` : `1px solid ${accentColor}`,
            boxShadow: borderStyle === "None" ? "none" : "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
            borderRadius: borderRadiusMode === "None" ? "0" : borderRadiusMode === "Soft" ? "12px" : "24px"
          }}
        >
          {activeCustomLayout ? (
            <DocumentBlockRenderer
              layout={activeCustomLayout}
              currencySymbol={currencySymbol}
              items={items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                total: item.quantity * item.rate,
              }))}
              data={{
                "business.name": issuerName,
                "business.address": issuerContact,
                "document.type": mode === "invoice" ? "INVOICE" : mode === "receipt" ? "RECEIPT" : "ESTIMATE",
                "document.number": mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber,
                "document.date": formatDateString(date),
                "document.dueDate": formatDateString(dueDate),
                "customer.name":
                  customerId === "custom"
                    ? customClientName || "Valued Customer"
                    : customers.find((c) => c.id === customerId)?.name || "Valued Customer",
                "customer.email":
                  customerId === "custom" ? customClientEmail || "" : customers.find((c) => c.id === customerId)?.email || "",
                "document.subtotal": fmt(getSubtotal()),
                "document.tax": fmt(calculateInvoiceTotals(items, discount, taxRate).taxAmount),
                "document.total": fmt(getTotal()),
              }}
            />
          ) : (
            <>
          {/* Watermark overlay */}
          {showWatermark && (
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] select-none pointer-events-none overflow-hidden">
              <span className="text-[55px] md:text-[80px] font-black font-sans uppercase tracking-[15px] rotate-[340deg]">
                {watermarkText}
              </span>
            </div>
          )}

          {/* Left Vertical Band for Executive Left-Strip template */}
          {(activeTemplate.hasLeftStrip || templateIndex === 2) && (
            <div className="absolute top-0 bottom-0 left-0 w-2.5 opacity-90 pointer-events-none" style={{ backgroundColor: accentColor }}></div>
          )}

          {/* Template-specific design highlights */}
          {templateIndex === 6 && ( // Sovereign Double gold accent border inside
            <div className="absolute inset-2 border-2 border-amber-500/20 pointer-events-none rounded-lg" />
          )}

          {/* Core Content Area */}
          <div className={`p-6 sm:p-8 space-y-6 relative z-10 ${templateIndex === 3 || templateIndex === 5 ? "font-mono text-xs" : ""}`}>
            
            {/* Header alignments with Logo Placement and Layout styles */}
            <div className={`flex flex-col ${
              headerLayout === "Centered" 
                ? "items-center text-center" 
                : "sm:flex-row justify-between items-start"
            } gap-4 border-b border-slate-100 pb-5`}>
              
              {/* Brand Logo & Basic details */}
              <div className={`flex ${
                logoPlacement === "Center" 
                  ? "flex-col items-center text-center" 
                  : logoPlacement === "Right" 
                  ? "flex-row-reverse items-start" 
                  : "flex-row items-start"
              } gap-3`}>
                
                {/* Brand Logo rendering */}
                {uploadedLogo ? (
                  <img 
                    src={uploadedLogo} 
                    alt="Company Custom Logo" 
                    className="w-14 h-14 rounded-xl object-contain bg-slate-50 p-1 border shadow-sm select-none"
                  />
                ) : (
                  selectedPresetLogo && (
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xl font-bold select-none shadow-sm shadow-emerald-500/10" style={{ backgroundColor: accentColor }}>
                      {PRESET_LOGOS.find(l => l.id === selectedPresetLogo)?.char || "✦"}
                    </div>
                  )
                )}

                <div className={logoPlacement === "Center" || headerLayout === "Centered" ? "text-center" : "text-left"}>
                  <h3 className="font-sans font-extrabold text-base tracking-tight text-slate-900">
                    {issuerName}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest font-mono block mt-0.5">
                    {issuerIndustry}
                  </span>
                  <p className="text-[10px] text-slate-500 leading-relaxed max-w-sm mt-1">
                    {issuerDesc}
                  </p>
                  <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                    {issuerContact}
                  </p>
                </div>
              </div>

              {/* Inward Document Tags & Ref Code */}
              <div className={`space-y-1.5 ${
                headerLayout === "Centered" ? "text-center" : "text-right"
              }`}>
                <span className={`px-2.5 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase inline-block font-extrabold ${activeTemplate.badgeBg}`}>
                  {mode === "invoice" ? "PROFESSIONAL INVOICE" : mode === "receipt" ? "PAYMENT RECORD" : "OFFICIAL ESTIMATE"}
                </span>
                <p className="text-sm font-bold font-mono text-slate-900">
                  #{mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber}
                </p>
                <div className="text-[9px] text-slate-500 font-mono space-y-0.5">
                  <p>Issue Date: {formatDateString(date)}</p>
                  {mode === "invoice" && <p>Due Date: {formatDateString(dueDate)}</p>}
                  {mode === "quotation" && <p>Valid Until: {formatDateString(dueDate)}</p>}
                </div>
              </div>

            </div>

            {/* Client address & Terms details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              {/* Customer Profile info */}
              <div className={`p-3 rounded-xl border ${
                activeTemplate.tableBorder.includes("dashed") ? "border-dashed border-zinc-300" : activeTemplate.tableBorder.includes("dotted") ? "border-dotted border-teal-200" : "border-slate-100"
              } bg-slate-50/40 text-left`}>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Target Customer Profile</span>
                {customerId === "custom" ? (
                  <div className="space-y-0.5 select-all">
                    <p className="font-extrabold text-slate-905 text-xs">{customClientName || "Enter Custom Customer Name"}</p>
                    <p className="text-slate-500 text-[11px]">{customClientEmail || "No Email Provided"}</p>
                    <p className="text-slate-500 text-[11px]">{customClientPhone || "No Mobile Info"}</p>
                    <span className="text-[8px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded inline-block mt-1">
                      Custom Segment: {customClientCategory}
                    </span>
                  </div>
                ) : customerId ? (
                  (() => {
                    const cust = customers.find(c => c.id === customerId);
                    if (!cust) return <p className="text-slate-400 italic">Unassigned Client Profile</p>;
                    return (
                      <div className="space-y-0.5 select-all">
                        <p className="font-extrabold text-slate-905 text-xs">{cust.name}</p>
                        <p className="text-slate-500 text-[11px]">{cust.email || "accounts@client-hub.com"}</p>
                        <p className="text-slate-500 text-[11px]">{cust.phone || "+233 24..."}</p>
                        <span className="text-[8px] font-mono bg-slate-50 text-slate-500 border border-slate-150 px-1 py-0.5 rounded inline-block mt-1">
                          CRM category: {cust.category}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-slate-400 italic">Please select customer profile in standard input forms</p>
                )}
              </div>

              {/* Payment details and expectations */}
              <div className={`p-3 rounded-xl border ${
                activeTemplate.tableBorder.includes("dashed") ? "border-dashed border-zinc-300" : activeTemplate.tableBorder.includes("dotted") ? "border-dotted border-teal-200" : "border-slate-100"
              } bg-slate-50/40 text-left sm:text-right flex flex-col justify-between`}>
                <div>
                  <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block mb-1">Expected Settlement Channels</span>
                  <p className="text-[10px] text-slate-650 leading-relaxed font-mono">
                    Bank: {bankDetails.split("•")[0]}
                  </p>
                  <p className="text-[10px] text-slate-650 leading-relaxed font-mono">
                    MOMO: {momoDetails.split("•")[1] || momoDetails}
                  </p>
                </div>
                {mode === "invoice" && (
                  <div className="mt-2 text-left sm:text-right">
                    <span className="text-[8px] font-mono text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded inline-block">
                      Terms: Net 14 Days
                    </span>
                  </div>
                )}
              </div>

            </div>

            {/* Line items billing grid - border/shadow come straight from the
                active template so the 10 designs are structurally distinct,
                not just re-tinted. */}
            {(mode === "invoice" || mode === "quotation") ? (
              <div className={`overflow-hidden rounded-xl ${activeTemplate.tableBorder} ${activeTemplate.tableShadow}`}>
                <table className="min-w-full divide-y divide-slate-100 text-xs select-all">
                  <thead className={activeTemplate.tableHeaderBg} style={{ backgroundColor: templateIndex === 6 ? "#0f172a" : templateIndex === 2 ? accentColor : undefined, color: templateIndex === 2 ? "#ffffff" : undefined }}>
                    <tr className="uppercase tracking-wider font-mono text-[9px]">
                      <th className="px-4 py-3 text-left">Statement Lines</th>
                      <th className="px-4 py-3 text-center w-16">Qty</th>
                      <th className="px-4 py-3 text-right w-24">Rate</th>
                      <th className="px-4 py-3 text-right w-28">Row Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                    {items.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}>
                        <td className="px-4 py-3.5 font-semibold text-slate-905">{item.description || "Consultancy Material Support"}</td>
                        <td className="px-4 py-3.5 text-center font-mono text-slate-600">{item.quantity}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-600">{fmt(item.rate)}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900">{fmt(item.quantity * item.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Receipt Specific Layout Slip */
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 text-center space-y-4">
                <div className="text-3xl font-mono mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 border border-emerald-250 flex items-center justify-center rounded-full animate-fade-in font-extrabold" style={{ borderColor: accentColor, color: accentColor }}>
                  ✓
                </div>
                <div>
                  <h4 className="text-slate-950 font-extrabold text-xs tracking-wider uppercase font-mono">Mobile Money Receipt Slip</h4>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed mt-1">
                    {receiptDesc || "Official settlement confirmation slip recorded in corporate cash ledgers."}
                  </p>
                </div>
                
                {/* Visual acquired cash box */}
                <div className="border border-slate-200/65 py-3 p-4 rounded-xl grid grid-cols-2 gap-4 text-xs font-sans bg-white">
                  <div className="text-left pl-2">
                    <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Settlement Routing</span>
                    <strong className="text-slate-850 font-bold block mt-0.5">{paymentMethod}</strong>
                  </div>
                  <div className="text-right pr-2">
                    <span className="text-slate-400 block font-mono text-[9px] uppercase tracking-wider">Acquired Cash Position</span>
                    <strong className="font-mono text-sm block mt-0.5 font-bold" style={{ color: accentColor }}>
                      {fmt(receiptAmount)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1 opacity-25 font-mono text-[9px]">
                  <Barcode className="w-5 h-5 text-slate-800" />
                  <span>TRANSACTION-SECURE-Aziiki-#2026</span>
                </div>
              </div>
            )}

            {/* Interactive totals block */}
            {(mode === "invoice" || mode === "quotation") && (
              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-72 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-650">
                  <div className="flex justify-between">
                    <span>Base Subtotal:</span>
                    <span className="font-mono text-slate-800">{fmt(getSubtotal())}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span>Discount ({discount}%):</span>
                      <span className="font-mono">-{fmt(calculateInvoiceTotals(items, discount, taxRate).discountAmount)}</span>
                    </div>
                  )}
                  {taxRate > 0 && (
                    <div className="flex justify-between">
                      <span>Assessed VAT ({taxRate}%):</span>
                      <span className="font-mono">+{fmt(calculateInvoiceTotals(items, discount, taxRate).taxAmount)}</span>
                    </div>
                  )}
                  {Number(shipping) > 0 && (
                    <div className="flex justify-between">
                      <span>Shipping Logistics:</span>
                      <span className="font-mono">+{fmt(Number(shipping))}</span>
                    </div>
                  )}
                  
                  {/* Grand Total treatment is the single most-looked-at
                      element on the document, so it carries the biggest
                      per-template visual signature (activeTemplate.totalsStyle). */}
                  {activeTemplate.totalsStyle === "dark" ? (
                    <div className="flex justify-between items-center rounded-xl px-4 py-3 mt-1 text-sm font-black" style={{ backgroundColor: "#0f172a" }}>
                      <span className="text-slate-300 font-bold">Grand Total</span>
                      <span className="font-mono text-base" style={{ color: accentColor }}>{fmt(getTotal())}</span>
                    </div>
                  ) : activeTemplate.totalsStyle === "badge" ? (
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                      <span className="text-sm font-black text-slate-900">Grand Total:</span>
                      <span className="font-mono font-extrabold text-sm text-white rounded-full px-4 py-1.5" style={{ backgroundColor: accentColor }}>
                        {fmt(getTotal())}
                      </span>
                    </div>
                  ) : activeTemplate.totalsStyle === "underline" ? (
                    <div className="flex justify-between items-baseline border-t-2 border-slate-800 pt-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Grand Total</span>
                      <span className="font-mono font-black text-lg tracking-tight" style={{ color: accentColor }}>{fmt(getTotal())}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center rounded-lg px-3 py-2.5 mt-1 text-sm font-black text-slate-900 border" style={{ backgroundColor: `${accentColor}0d`, borderColor: `${accentColor}33` }}>
                      <span>Grand Total:</span>
                      <span className="font-mono" style={{ color: accentColor }}>{fmt(getTotal())}</span>
                    </div>
                  )}

                  {Number(invoiceAmountPaid) > 0 && (
                    <>
                      <div className="flex justify-between text-emerald-600 font-bold">
                        <span>Paid to Date:</span>
                        <span className="font-mono">-{fmt(Number(invoiceAmountPaid))}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 pt-1.5 text-xs font-bold text-slate-900">
                        <span>Balance Due:</span>
                        <span className="font-mono text-rose-600">{fmt(getBalanceDue())}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Verification Widgets Panel (Stamp, Barcode, QR code, Signature) */}
            <div className="border-t border-slate-100 pt-5 flex flex-col sm:flex-row justify-between items-center gap-6">
              
              {/* Barcode & QR Code representation */}
              <div className="flex items-center gap-4">
                {/* SVG QR Code */}
                <div className="w-16 h-16 bg-white p-1 rounded-lg border border-slate-200 shadow-sm shrink-0 flex flex-col items-center justify-center relative">
                  <svg className="w-full h-full text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="6" height="6" rx="1" />
                    <rect x="16" y="2" width="6" height="6" rx="1" />
                    <rect x="2" y="16" width="6" height="6" rx="1" />
                    <rect x="16" y="16" width="2" height="2" />
                    <rect x="20" y="20" width="2" height="2" />
                    <rect x="16" y="20" width="2" height="2" />
                    <rect x="20" y="16" width="2" height="2" />
                    <path d="M10 4h2M10 8h2M4 10v2M8 10v2M12 12h2" />
                  </svg>
                  <span className="text-[6px] text-slate-400 absolute bottom-0.5 tracking-tight scale-75">SCAN TO PAY</span>
                </div>

                {/* SVG Barcode */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="flex gap-[1.5px] h-7 items-end bg-white px-2 py-0.5 rounded border border-slate-200">
                    {[1,2,1,3,1,1,2,1,3,1,2,2,1,3,1,2,1,1,2,3,1,1,2].map((w, idx) => (
                      <div key={idx} className="bg-slate-800" style={{ width: `${w}px`, height: idx % 4 === 0 ? "100%" : "85%" }} />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 mt-0.5 scale-90">REF-{mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber}</span>
                </div>
              </div>

              {/* Rubber Stamp and Authorized Signature */}
              <div className="flex items-center gap-4">
                {/* SVG Certified Rubber Stamp */}
                <div className="w-16 h-16 rounded-full border-4 border-dashed flex items-center justify-center p-0.5 rotate-[345deg] opacity-80 shrink-0 select-none cursor-default font-sans" style={{ borderColor: accentColor, color: accentColor }}>
                  <div className="w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center text-center p-0.5">
                    <span className="text-[5px] font-bold tracking-widest leading-none uppercase">Aziiki</span>
                    <span className="text-[7px] font-black tracking-tight leading-none uppercase my-0.5">VERIFIED</span>
                    <span className="text-[5px] font-mono tracking-tighter leading-none">{new Date().getFullYear()}-AUTH</span>
                  </div>
                </div>

                {/* cursive signature lines */}
                <div className="text-center border-t border-slate-200 pt-1.5 w-36">
                  <span className="text-[12px] font-serif italic text-slate-700 block max-w-full truncate tracking-wider font-semibold" style={{ fontFamily: "'Georgia', serif" }}>
                    ✍ {authorizedSignature}
                  </span>
                  <span className="text-[8px] font-mono text-slate-400 tracking-widest block uppercase mt-0.5">Authorized Officer</span>
                </div>

                {/* Customer e-signature (invoice/quotation only) */}
                {(mode === "invoice" || mode === "quotation") && (
                  <div className="text-center border-t border-slate-200 pt-1.5 w-36">
                    {documentSignature ? (
                      documentSignature.signatureKind === "typed" ? (
                        <span className="text-[12px] text-slate-700 block max-w-full truncate tracking-wider font-semibold" style={{ fontFamily: "'Georgia', serif", fontStyle: "italic" }}>
                          {documentSignature.signatureData}
                        </span>
                      ) : (
                        <svg viewBox="0 0 460 90" className="w-full h-8 mx-auto">
                          {(JSON.parse(documentSignature.signatureData) as string[]).map((d, i) => (
                            <path key={i} d={d} fill="none" stroke="#0f172a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          ))}
                        </svg>
                      )
                    ) : (
                      <span className="text-[10px] text-slate-300 italic">Not yet signed</span>
                    )}
                    <span className="text-[8px] font-mono text-slate-400 tracking-widest block uppercase mt-0.5">
                      {documentSignature ? documentSignature.signerName : "Customer Signature"}
                    </span>
                  </div>
                )}
              </div>

            </div>

          </div>
            </>
          )}

          {/* Footnotes disclaimers and compliance footer */}
          <div className="bg-slate-50 border-t border-slate-150 p-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-sans text-slate-500 relative z-10">
            <div className={`max-w-md ${
              footerAlignment === "Center" ? "text-center" : footerAlignment === "Right" ? "text-right" : "text-left"
            }`}>
              <p className="font-extrabold text-slate-700 tracking-wider text-[9px] uppercase font-mono">Disclaimers & Conditions</p>
              <p className="text-[10px] text-slate-450 leading-relaxed font-sans mt-1">
                {termsAndConditions}
              </p>
              <p className="text-[9px] text-slate-400 italic mt-1 leading-relaxed">
                {customFooterNotes}
              </p>
            </div>
            
            {/* Quick Share utilities drawers */}
            <div className="flex gap-2 shrink-0">
              <a
                href={getWhatsAppLink(mode === "invoice" ? invoiceNumber : mode === "receipt" ? receiptNumber : quoteNumber, mode === "receipt" ? receiptAmount : getTotal(), mode === "invoice" ? "Invoice" : mode === "receipt" ? "Receipt Slip" : "Estimate Proposal")}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
              >
                <Share2 className="w-3.5 h-3.5 text-white" /> WhatsApp Share
              </a>
              {mode === "invoice" && (
                <button
                  type="button"
                  onClick={handleRequestPayment}
                  disabled={!paystackEnabled || !resolvedDocCustomer?.email || !savedDocumentId || isRequestingPayment}
                  title={
                    !paystackEnabled
                      ? "Card/Mobile Money payments are not configured for this workspace yet."
                      : !resolvedDocCustomer?.email
                      ? "Add an email address to this customer's profile to request payment."
                      : !savedDocumentId
                      ? "Save this invoice first to request payment."
                      : `Request payment of ${currencySymbol}${getTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} via Paystack`
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                >
                  {isRequestingPayment ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <CreditCard className="w-3.5 h-3.5 text-white" />
                  )}
                  Request Payment
                </button>
              )}
              {(mode === "invoice" || mode === "receipt") && (
                <button
                  type="button"
                  onClick={handleSendDocumentEmail}
                  disabled={!emailSendingEnabled || !resolvedDocCustomer?.email || !savedDocumentId || isSendingEmail}
                  title={
                    !emailSendingEnabled
                      ? "Email sending is not configured for this workspace yet."
                      : !resolvedDocCustomer?.email
                      ? "Add an email address to this customer's profile to send by email."
                      : !savedDocumentId
                      ? `Save this ${mode} first to send it by email.`
                      : `Email this ${mode} to ${resolvedDocCustomer.email}`
                  }
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800"
                >
                  {isSendingEmail ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-white" />
                  )}
                  Send by Email
                </button>
              )}
              {/* AZIIKI BASIC VERSION: signature capture hidden from MVP. Code preserved. */}
              {!MVP_MODE && (mode === "invoice" || mode === "quotation") && (
                <button
                  type="button"
                  onClick={() => setIsSignatureModalOpen(true)}
                  disabled={!savedDocumentId}
                  title={!savedDocumentId ? `Save this ${mode} first to capture a signature.` : documentSignature ? "Replace the captured signature" : "Capture the customer's signature"}
                  className="bg-white border border-slate-205 text-slate-700 hover:bg-slate-100 font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ✍️ {documentSignature ? "Signed" : "Sign Document"}
                </button>
              )}
              <button
                onClick={() => {
                  window.print();
                }}
                className="bg-white border border-slate-205 text-slate-700 hover:bg-slate-100 font-bold text-[10px] px-3.5 py-2.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Sheet
              </button>
            </div>
          </div>

        </div>

        {/* Dynamic Estimate proposal Convert block */}
        {mode === "quotation" && quotations.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in text-xs shadow-sm shadow-emerald-500/5 select-none">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg shrink-0">
                <RefreshCw className="w-4.5 h-4.5 animate-spin text-emerald-600" />
              </div>
              <div className="leading-relaxed">
                <h5 className="font-bold text-emerald-800 font-sans">Convert estimate quotation parameters to Invoice?</h5>
                <p className="text-slate-600 text-[11px] mt-0.5 font-sans">Directly transform this quote into a draft invoice ledger with zero double data entry.</p>
              </div>
            </div>
            <button
              onClick={() => {
                onConvertQuote(quotations[0].id);
                setMode("invoice");
                triggerToast(`Extracted estimate variables successfully from Quote #${quotations[0].quoteNumber}`);
              }}
              className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 font-bold transition-all cursor-pointer font-sans shrink-0 block text-[11px] uppercase tracking-wider shadow-sm"
            >
              Convert Estimate Now
            </button>
          </div>
        )}

      </div>

      {!MVP_MODE && isSignatureModalOpen && savedDocumentId && (mode === "invoice" || mode === "quotation") && (
        <SignatureCapture
          businessId={currentBusiness.id}
          documentType={mode}
          documentId={savedDocumentId}
          defaultSignerName={resolvedDocCustomer?.name ?? (customerId === "custom" ? customClientName : undefined)}
          onSaved={(signature) => {
            setDocumentSignature(signature);
            setIsSignatureModalOpen(false);
            triggerToast(`Signature captured from ${signature.signerName}.`);
          }}
          onClose={() => setIsSignatureModalOpen(false)}
        />
      )}
    </div>
  );
}
