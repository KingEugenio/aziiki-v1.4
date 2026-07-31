import React, { useState, useEffect } from "react";
import EmptyState from "./errors/EmptyState";
import { ArrowUpRight, ArrowDownRight, Coins, Calculator, TrendUp as TrendingUp, Pulse as Activity, Plus, Trash as Trash2, CheckCircle, DeviceMobile as Smartphone, Wallet, Buildings as Building, WarningCircle as AlertCircle, DownloadSimple as Download, UploadSimple as Upload, Database, MagicWand as Sparkles, ShieldWarning as ShieldAlert, Users, Briefcase, ClockCounterClockwise as History, TrendDown as TrendingDown, UserCheck } from "@phosphor-icons/react";
import { Transaction, Customer, Business, Invoice, Debt, Partner, Shareholder, AuditLog, UserRole } from "../types";

interface BusinessDashboardProps {
  currentBusiness: Business;
  transactions: Transaction[];
  customers: Customer[];
  invoices: Invoice[];
  currencySymbol: string;
  onAddTransaction: (trans: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onRestoreBackup?: (backup: any) => void;
  debts: Debt[];
}

export default function BusinessDashboard({
  currentBusiness,
  transactions,
  customers,
  invoices,
  currencySymbol,
  onAddTransaction,
  onDeleteTransaction,
  onRestoreBackup,
  debts
}: BusinessDashboardProps) {
  // Rapid cashbook toggler
  const [isOpeningLogs, setIsOpeningLogs] = useState<boolean>(true); // default open for convenience
  
  // Ledger forms states
  const [amount, setAmount] = useState<number>(300);
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState<string>("Client Project");
  const [description, setDescription] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"Mobile Money" | "Cash" | "Bank Transfer">("Mobile Money");
  const [customerId, setCustomerId] = useState<string>("");

  // SMS Parser States
  const [showSmsInput, setShowSmsInput] = useState<boolean>(false);
  const [rawSmsText, setRawSmsText] = useState<string>("");
  const [smsParserMsg, setSmsParserMsg] = useState<{ status: "success" | "error"; text: string } | null>(null);

  // Database actions notifications
  const [dbStatus, setDbStatus] = useState<string | null>(null);

  // Localized state binders for Business Identity behaviors
  const [localPartners, setLocalPartners] = useState<Partner[]>(currentBusiness.partners || []);
  const [partnerWithdrawalName, setPartnerWithdrawalName] = useState<string>("");
  const [partnerWithdrawalAmount, setPartnerWithdrawalAmount] = useState<number>(0);
  const [withdrawalMsg, setWithdrawalMsg] = useState<string | null>(null);

  // Corporate quarantined approvals ledger
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([
    {
      id: "appr-1",
      date: new Date().toISOString().substring(0, 10),
      type: "expense",
      category: "Operations Cost",
      amount: 1450,
      description: "Bulk studio generator fueling costs",
      paymentMethod: "Bank Transfer",
      staffName: "Kofi Owusu (Accountant)"
    },
    {
      id: "appr-2",
      date: new Date().toISOString().substring(0, 10),
      type: "expense",
      category: "Materials Purchase",
      amount: 620,
      description: "Direct textile purchase from central Ikeja supplier",
      paymentMethod: "Cash",
      staffName: "Abena Mensah (Staff)"
    }
  ]);
  const [approvalAlert, setApprovalAlert] = useState<string | null>(null);

  // Keep localPartners state in sync with currentBusiness object
  useEffect(() => {
    const list = currentBusiness.partners || [];
    setLocalPartners(list);
    if (list.length > 0) {
      setPartnerWithdrawalName(list[0].name);
    } else {
      setPartnerWithdrawalName("");
    }
  }, [currentBusiness.id, currentBusiness.partners]);

  const activeTransactions = transactions.filter(t => t.businessId === currentBusiness.id);

  // Math aggregates
  const totalRevenue = activeTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = activeTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalRevenue - totalExpenses;
  const marginPercentage = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

  const outstandingInvoices = invoices
    .filter(inv => inv.businessId === currentBusiness.id && (inv.status === "Sent" || inv.status === "Overdue"))
    .reduce((sum, inv) => {
      const invTotal = inv.items.reduce((acc, current) => acc + (current.quantity * current.rate), 0);
      const taxAmount = (invTotal * inv.taxRate) / 100;
      const discountAmount = (invTotal * inv.discount) / 100;
      return sum + (invTotal + taxAmount - discountAmount - inv.partialPaidAmount);
    }, 0);

  // Business Health Score Formulation
  const calcHealthScore = () => {
    let score = 55; // baseline rating
    if (marginPercentage > 30) score += 15;
    else if (marginPercentage > 10) score += 8;

    // Outstanding invoices penalty weights
    if (outstandingInvoices === 0) score += 20;
    else if (outstandingInvoices < (totalRevenue * 0.2)) score += 12;
    else score -= 5;

    // Ledger flow logs
    if (activeTransactions.length > 5) score += 10;
    
    return Math.min(100, Math.max(25, score));
  };

  const healthScore = calcHealthScore();

  const handleParseSms = () => {
    if (!rawSmsText.trim()) {
      setSmsParserMsg({ status: "error", text: "Please paste a raw Mobile Money or bank SMS receipt first." });
      return;
    }

    const text = rawSmsText;

    // Matches standard mobile transaction formats (GHS 500.00 / 5,000 NGN / Ksh 2500)
    const amountRegex = /(?:GHS|NGN|KES|USD|UGX|TZS|RWF|ZAR|EUR|Kshs?|GHC|sh\.[^\d]*|₦|₵)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:GHS|NGN|KES|USD|UGX|TZS|RWF|ZAR|Mobile Money|MoMo)/i;
    let extractedAmount = 0;
    const matchAmount = text.match(amountRegex);
    if (matchAmount) {
      const numStr = matchAmount[1] || matchAmount[2];
      if (numStr) {
        extractedAmount = parseFloat(numStr.replace(/,/g, ''));
      }
    } else {
      const fallbackMatch = text.match(/(?:received|sent|paid|of|amount)\s*(?:of\s*)?([\d,]+(?:\.\d{1,2})?)/i);
      if (fallbackMatch && fallbackMatch[1]) {
        extractedAmount = parseFloat(fallbackMatch[1].replace(/,/g, ''));
      }
    }

    if (!extractedAmount || isNaN(extractedAmount)) {
      setSmsParserMsg({ status: "error", text: "Could not find a valid financial amount in the text. Try copying the raw SMS." });
      return;
    }

    let extractedType: "income" | "expense" = "income";
    if (/sent|paid|transfer to|payment to|withdrawn|debited|outflow/i.test(text)) {
      extractedType = "expense";
    }

    let referenceCode = "";
    const refMatch = text.match(/(?:Trans\s*ID|TxID|Ref|Reference|Transaction ID|ID)[:\s]*([A-Z0-9]+)/i);
    if (refMatch && refMatch[1]) {
      referenceCode = refMatch[1];
    }

    const personMatch = text.match(/(?:from|to|paid\s+to|received\s+from)\s+([A-Z][a-zA-Z\s]{2,20})/);
    const partyName = personMatch ? personMatch[1].trim() : "";

    let extractedDesc = "";
    if (partyName) {
      extractedDesc = `${extractedType === "income" ? "M-Money Inflow from" : "M-Money Outflow to"} ${partyName}`;
      if (referenceCode) extractedDesc += ` (Ref: ${referenceCode})`;
    } else if (referenceCode) {
      extractedDesc = `${extractedType === "income" ? "Income Ledger Alert" : "Expense Ledger Alert"} - Ref: ${referenceCode}`;
    } else {
      extractedDesc = `${extractedType === "income" ? "Direct Client Settlement" : "Operational Supplier Cost"}`;
    }

    let matchedCategory = "Client Project";
    if (extractedType === "expense") {
      if (/fabric|material|yarn|cloth|textile/i.test(text)) {
        matchedCategory = "Materials Purchase";
      } else if (/transport|transit|fuel|delivery|logistics|uber/i.test(text)) {
        matchedCategory = "Logistics";
      } else if (/rent|studio|power|generator/i.test(text)) {
        matchedCategory = "Operations Cost";
      } else {
        matchedCategory = "Operations Cost";
      }
    } else {
      if (/sales|order|shop|product|retail|sold/i.test(text)) {
        matchedCategory = "Direct Sales";
      } else if (/consult|advise|audit|coach/i.test(text)) {
        matchedCategory = "Consulting Fee";
      } else {
        matchedCategory = "Client Project";
      }
    }

    setAmount(extractedAmount);
    setType(extractedType);
    setCategory(matchedCategory);
    setPaymentMethod("Mobile Money");
    setDescription(extractedDesc);

    setSmsParserMsg({
      status: "success",
      text: `✓ Auto-filled: ${currentBusiness.currency} ${extractedAmount} applied as ${matchedCategory} (${extractedType === "income" ? "Inflow" : "Outflow"})`
    });

    setRawSmsText("");
    setTimeout(() => setSmsParserMsg(null), 5000);
  };

  const handleExportCSV = () => {
    const escapeCSV = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csvRows = [
      ["Date", "Type", "Category", "Amount", "Description", "Payment Method", "Business Module"].join(",")
    ];

    activeTransactions.forEach(t => {
      const row = [
        t.date,
        t.type,
        t.category,
        t.amount,
        escapeCSV(t.description),
        t.paymentMethod,
        escapeCSV(currentBusiness.name)
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${currentBusiness.name.replace(/\s+/g, '_')}_ledgers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDbStatus("✓ Exported Excel CSV successfully!");
    setTimeout(() => setDbStatus(null), 3000);
  };

  const handleExportJSON = () => {
    const backupObj = {
      transactions: transactions,
      customers: customers,
      invoices: invoices,
      exportDate: new Date().toISOString(),
      sourceBiz: currentBusiness.name
    };

    const str = JSON.stringify(backupObj, null, 2);
    const blob = new Blob([str], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Aziiki_Backup_${currentBusiness.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDbStatus("✓ JSON database downloaded!");
    setTimeout(() => setDbStatus(null), 3005);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && (parsed.transactions || parsed.customers || parsed.invoices)) {
          if (onRestoreBackup) {
            onRestoreBackup(parsed);
            setDbStatus("✓ Success! Sandbox registers restored.");
          }
        } else {
          setDbStatus("Err: Excel/JSON schema mismatch.");
        }
      } catch (err) {
        setDbStatus("Err: JSON parsing failure.");
      }
      setTimeout(() => setDbStatus(null), 4000);
    };
    reader.readAsText(file);
  };

  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    const descName = description || `${type === "income" ? "Client billing" : "Supplier cost"} settlement`;

    // INTERCEPT RULES: Company mode dual-approvals
    if (currentBusiness.businessType === "Company" && currentBusiness.allowFinancialApprovals && amount > 500) {
      const pendingTx = {
        id: "appr-" + Math.random().toString(36).substr(2, 5),
        date: new Date().toISOString().split("T")[0],
        type,
        category,
        amount,
        description: descName,
        paymentMethod,
        staffName: "Active Accountant Role"
      };
      setPendingApprovals([pendingTx, ...pendingApprovals]);
      setApprovalAlert(`⚠️ Dual-signature sign-off alert: High-value transaction for ${currencySymbol}${amount} has been quarantined in the approval queue.`);
      
      // Reset Form values
      setAmount(100);
      setDescription("");
      setCustomerId("");
      
      setTimeout(() => setApprovalAlert(null), 7000);
      return;
    }

    const newTx: Transaction = {
      id: "tx-" + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split("T")[0],
      type,
      category,
      amount,
      description: descName,
      paymentMethod,
      customerId: customerId || undefined,
      businessId: currentBusiness.id
    };

    onAddTransaction(newTx);
    
    // Reset Form values
    setAmount(100);
    setDescription("");
    setCustomerId("");
  };

  // AZIIKI DESIGN SYSTEM: shared export/restore block markup, used once in
  // desktop position and once in mobile position (same pattern as before —
  // two render sites toggled by breakpoint visibility — kept intact so
  // structure/behavior is identical, only the visual layer changed).
  const exportsPanel = (
    <div className="az-card p-5 flex flex-col gap-4">
      <div className="border-b pb-3 flex items-center gap-2.5" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="p-2 rounded-xl az-chip-accent">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider font-sans" style={{ color: "var(--text-primary)" }}>
            Exports &amp; Database Backups
          </h4>
          <span className="text-[10px] block text-left" style={{ color: "var(--text-secondary)" }}>Manage spreadsheet reports &amp; backups</span>
        </div>
      </div>

      <div className="space-y-2.5 text-xs text-left">
        <div className="grid grid-cols-2 gap-2">
          {/* CSV Export Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="az-btn az-btn-secondary micro-press py-2.5"
          >
            <Download className="w-3.5 h-3.5" style={{ color: "var(--positive)" }} />
            Excel CSV
          </button>

          {/* JSON Export Button */}
          <button
            type="button"
            onClick={handleExportJSON}
            className="az-btn az-btn-secondary micro-press py-2.5"
          >
            <Download className="w-3.5 h-3.5 text-purple-500" />
            JSON Backup
          </button>
        </div>

        {/* RESTORE DATABASE BLOCK */}
        <div className="az-card-inset p-3 space-y-2">
          <span className="text-[9px] font-mono uppercase tracking-wider font-bold block text-left" style={{ color: "var(--text-tertiary)" }}>Restore sandbox backup</span>
          <p className="text-[10px] leading-relaxed text-left" style={{ color: "var(--text-secondary)" }}>
            Restore previously backed up JSON ledger records instantly into your offline safe space.
          </p>

          <label className="az-btn az-btn-secondary micro-press w-full py-1.5 px-3 text-[10px]">
            <Upload className="w-3 h-3" style={{ color: "var(--positive)" }} />
            Upload .json file
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>
        </div>

        {/* Status notifications */}
        {dbStatus && (
          <div className="p-2 text-center rounded-lg text-[10px] font-mono az-chip-positive animate-fade-in">
            {dbStatus}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div id="dashboard-tab-root" className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 font-sans" style={{ color: "var(--text-primary)" }}>

      {/* LEFT BLOCK: Key metric tiles & Cashflow visualization charts */}
      <div className="xl:col-span-8 flex flex-col gap-5 sm:gap-6">

        {/* Core Metric highlights row — horizontal scroll on phones so all
            three stay full-width cards instead of being squeezed 3-up. */}
        <div className="flex xl:grid xl:grid-cols-3 gap-3.5 sm:gap-4 overflow-x-auto sm:overflow-visible -mx-1 px-1 pb-1 sm:pb-0 custom-scrollbar">

          <div className="az-card az-card-interactive az-elevation-1 p-5 relative overflow-hidden shrink-0 w-[78vw] xs:w-auto sm:w-auto">
            <div className="absolute right-3 top-3 az-chip-positive p-2.5 rounded-xl transition-transform duration-300 hover:rotate-6">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider block font-sans" style={{ color: "var(--text-tertiary)" }}>
              {currentBusiness.businessType === "Sole Proprietor" ? "My Money Inflows" : "Total Revenue Ledger"}
            </span>
            <strong className="text-[26px] font-black font-sans block mt-2 tracking-tight" style={{ color: "var(--text-primary)" }}>
              {currencySymbol}{totalRevenue.toLocaleString()}
            </strong>
            <span className="text-[10px] flex items-center gap-1.5 mt-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
              <span className="az-chip-positive p-0.5 rounded-md flex items-center justify-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
              {currentBusiness.businessType === "Sole Proprietor" ? "all logged trade earnings" : "cumulative business inflows"}
            </span>
          </div>

          <div className="az-card az-card-interactive az-elevation-1 p-5 relative overflow-hidden shrink-0 w-[78vw] xs:w-auto sm:w-auto">
            <div className="absolute right-3 top-3 az-chip-negative p-2.5 rounded-xl transition-transform duration-300 hover:rotate-6">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider block font-sans" style={{ color: "var(--text-tertiary)" }}>
              {currentBusiness.businessType === "Sole Proprietor" ? "My Expenses" : currentBusiness.businessType === "Partnership" ? "Joint Expenses" : "Corporate Expenses"}
            </span>
            <strong className="text-[26px] font-black font-sans block mt-2 tracking-tight" style={{ color: "var(--text-primary)" }}>
              {currencySymbol}{totalExpenses.toLocaleString()}
            </strong>
            <span className="text-[10px] flex items-center gap-1.5 mt-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
              <span className="az-chip-negative p-0.5 rounded-md flex items-center justify-center">
                <ArrowDownRight className="w-3.5 h-3.5" />
              </span>
              {currentBusiness.businessType === "Sole Proprietor" ? "personal pocket outflows" : "operating cash leaks logged"}
            </span>
          </div>

          <div className="az-card az-card-interactive az-elevation-1 p-5 relative overflow-hidden shrink-0 w-[78vw] xs:w-auto sm:w-auto">
            <div className="absolute right-3 top-3 az-chip-accent p-2.5 rounded-xl transition-transform duration-300 hover:rotate-6">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider block font-sans" style={{ color: "var(--text-tertiary)" }}>
              {currentBusiness.businessType === "Sole Proprietor" ? "My Personal Profit" : "Net Profit / Margin"}
            </span>
            <strong className="text-[26px] font-black font-sans block mt-2 tracking-tight" style={{ color: netProfit >= 0 ? "var(--positive)" : "var(--negative)" }}>
              {currencySymbol}{netProfit.toLocaleString()}
            </strong>
            <span className="text-[10px] flex items-center gap-1.5 mt-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>
              <span className="px-1.5 py-0.5 rounded-md font-bold font-mono text-[9px] mr-1 az-card-inset">
                {marginPercentage}%
              </span>
              {currentBusiness.businessType === "Sole Proprietor" ? "net surplus margin" : "Profit margin percentage"}
            </span>
          </div>

        </div>

        {/* Real-time cashflow chart visualizer (D3-inspired custom SVG layout) */}
        <div className="az-card az-elevation-1 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4 mb-5" style={{ borderColor: "var(--border-subtle)" }}>
            <div>
              <h3 className="text-sm font-bold font-sans flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <span className="p-1.5 rounded-lg az-chip-accent"><Activity className="w-3.5 h-3.5" /></span>
                Ledger Cash Inflow / Outflow Trends
              </h3>
              <p className="text-xs font-sans mt-1 ml-8" style={{ color: "var(--text-secondary)" }}>
                Weekly visual cash balance flow chart.
              </p>
            </div>

            <div className="flex gap-4 text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full block" style={{ background: "var(--positive)" }}></span>
                Inflows
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full block" style={{ background: "var(--negative)" }}></span>
                Outflows
              </span>
            </div>
          </div>

          {/* SVG canvas renderer */}
          <div className="h-44 sm:h-48 w-full az-card-inset relative p-4">
            <svg viewBox="0 0 500 150" className="w-full h-full">
              {/* Grid Lines */}
              <line x1="10" y1="20" x2="490" y2="20" stroke="var(--border-default)" strokeWidth="0.75" strokeDasharray="3" />
              <line x1="10" y1="75" x2="490" y2="75" stroke="var(--border-default)" strokeWidth="0.75" strokeDasharray="3" />
              <line x1="10" y1="130" x2="490" y2="130" stroke="var(--border-default)" strokeWidth="0.75" strokeDasharray="3" />

              {/* Dynamic Path lines */}
              {activeTransactions.length > 1 ? (
                <>
                  {/* Revenue Curve */}
                  <path
                    d="M 10,110 L 120,60 L 230,25 L 340,90 L 490,40"
                    fill="none"
                    stroke="var(--positive)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    className="opacity-95"
                  />
                  {/* Expense curve */}
                  <path
                    d="M 10,140 L 120,110 L 230,120 L 340,55 L 490,115"
                    fill="none"
                    stroke="var(--negative)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="opacity-80"
                  />

                  {/* Data Anchor dots */}
                  <circle cx="230" cy="25" r="4.5" fill="var(--positive)" stroke="var(--surface-card-2)" strokeWidth="1.5" />
                  <circle cx="340" cy="55" r="4.5" fill="var(--negative)" stroke="var(--surface-card-2)" strokeWidth="1.5" />
                </>
              ) : (
                /* Static flat representation if no data points exist */
                <path d="M 10,75 H 490" fill="none" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="2" />
              )}
            </svg>

            {activeTransactions.length <= 1 && (
              <div className="absolute inset-0 flex items-center justify-center font-sans text-xs italic p-4 rounded-xl text-center border border-dashed" style={{ color: "var(--text-secondary)", borderColor: "var(--border-default)", background: "color-mix(in srgb, var(--surface-card-2) 92%, transparent)" }}>
                Log progressive ledger transactions using the rapid cashbook drawer to render your cashflow curves!
              </div>
            )}
          </div>
        </div>

        {/* Database & Reports Utility - Full Screen Only */}
        <div className="hidden xl:block">{exportsPanel}</div>

      </div>

      {/* RIGHT BLOCK: Business Health score circular visualization and ledger drawer */}
      <div className="xl:col-span-4 flex flex-col gap-5 sm:gap-6">

        {/* Business score dial card */}
        <div className="az-card az-elevation-1 p-6 text-center space-y-4">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest font-sans" style={{ color: "var(--text-tertiary)" }}>
              Business Health Score
            </h4>
            <p className="text-[11px] font-sans mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Automated audit evaluation of stability vector thresholds.
            </p>
          </div>

          {/* Dials visual graphics */}
          <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
            {/* SVG circle meter */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="58"
                stroke="var(--border-default)"
                strokeWidth="9"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="58"
                stroke="var(--accent)"
                strokeWidth="9"
                fill="transparent"
                strokeDasharray={364.4}
                strokeDashoffset={364.4 - (364.4 * healthScore) / 100}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)", filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 35%, transparent))" }}
              />
            </svg>

            <div className="absolute text-center">
              <strong className="text-3xl font-black font-mono tracking-tighter" style={{ color: "var(--text-primary)" }}>
                {healthScore}
              </strong>
              <span className="text-[10px] font-mono block tracking-widest" style={{ color: "var(--accent)" }}>PTS</span>
            </div>
          </div>

          {/* Health feedback text */}
          <div className="pt-1">
            <span className="font-sans font-bold text-xs block" style={{ color: "var(--text-primary)" }}>
              {healthScore >= 75 ? "🚀 Pristine Solvency Position" : healthScore >= 50 ? "⚡ Variable Operational Health" : "⚠️ High Liquidity Warnings"}
            </span>
            <p className="text-[11px] max-w-xs mx-auto leading-relaxed mt-1 font-sans" style={{ color: "var(--text-secondary)" }}>
              Calculated based on profit margin targets, cash liquidity levels, and collection delays.
            </p>
          </div>
        </div>

        {/* Rapid Ledger Cashbook trigger panel */}
        <div className="az-card az-elevation-1 p-5 flex flex-col gap-4">
          <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 font-sans" style={{ color: "var(--text-primary)" }}>
                <Calculator className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Ledger Book Drawer
              </h4>
              <span className="text-[10px] block" style={{ color: "var(--text-secondary)" }}>Record fast cash transactions</span>
            </div>

            <button
              id="open-ledger-drawer-btn"
              onClick={() => setIsOpeningLogs(!isOpeningLogs)}
              aria-expanded={isOpeningLogs}
              aria-label={isOpeningLogs ? "Collapse ledger drawer" : "Expand ledger drawer"}
              className="az-btn az-chip-accent p-2.5 micro-press !rounded-xl"
            >
              <Plus className={`w-4 h-4 transition-transform duration-300 ${isOpeningLogs ? "rotate-45" : ""}`} />
            </button>
          </div>

          {/* Ledger Add form drawer */}
          {isOpeningLogs && (
            <form onSubmit={handleSaveTransaction} className="space-y-3.5 animate-slide-up text-xs leading-relaxed">
              <div className="grid grid-cols-2 gap-2 az-card-inset p-1">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`py-2 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
                    type === "income" ? "shadow-sm" : ""
                  }`}
                  style={type === "income" ? { background: "var(--positive)", color: "#fff" } : { color: "var(--text-secondary)" }}
                >
                  Inflow (Revenue)
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`py-2 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
                    type === "expense" ? "shadow-sm" : ""
                  }`}
                  style={type === "expense" ? { background: "var(--negative)", color: "#fff" } : { color: "var(--text-secondary)" }}
                >
                  Outflow (Expense)
                </button>
              </div>

              {/* SMS Automatic Parser Sub-Block */}
              <div className="az-card-inset p-2.5 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-sans font-medium" style={{ color: "var(--text-secondary)" }}>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" style={{ color: "var(--accent)" }} />
                    Mobile Money SMS Auto-Fill
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSmsInput(!showSmsInput)}
                    className="hover:underline font-bold"
                    style={{ color: "var(--accent)" }}
                  >
                    {showSmsInput ? "Hide paste box" : "Use SMS paste"}
                  </button>
                </div>

                {showSmsInput && (
                  <div className="space-y-2 animate-fade-in text-[10px]">
                    <textarea
                      rows={2}
                      placeholder="Paste e.g., 'You have received GHS 1,500 from...' or a mobile money receipt alert..."
                      value={rawSmsText}
                      onChange={(e) => setRawSmsText(e.target.value)}
                      className="az-input w-full p-2 text-[11px] font-sans"
                    />
                    <button
                      type="button"
                      onClick={handleParseSms}
                      className="az-btn micro-press w-full py-2 text-[10px]"
                      style={{ background: "var(--accent-strong)", color: "#fff" }}
                    >
                      ✨ Quick Parse SMS Alert
                    </button>
                  </div>
                )}

                {smsParserMsg && (
                  <div className={`p-2 rounded-lg text-[10px] font-medium leading-relaxed font-sans ${
                    smsParserMsg.status === "success" ? "az-chip-positive" : "az-chip-negative"
                  }`}>
                    {smsParserMsg.text}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono font-bold" style={{ color: "var(--text-tertiary)" }}>Amount ({currencySymbol})</label>
                  <input
                    id="param-amount"
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="az-input w-full px-2.5 py-2 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono font-bold" style={{ color: "var(--text-tertiary)" }}>Classification</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="az-input w-full px-2 py-2 mt-1 font-sans"
                  >
                    {type === "income" ? (
                      <>
                        <option value="Client Project">Client Project / Contract</option>
                        <option value="Direct Sales">Retail / Wholesale sale</option>
                        <option value="Consulting Fee">Strategy Retainer</option>
                        <option value="Interest Earnings">Treasury Yields</option>
                      </>
                    ) : (
                      <>
                        <option value="Operations Cost">Operations / Studio rent</option>
                        <option value="Materials Purchase">Textiles & Materials</option>
                        <option value="Logistics">Transport & logistics</option>
                        <option value="Outsource Help">Contractor support</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-mono font-bold" style={{ color: "var(--text-tertiary)" }}>Payment Source</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="az-input w-full px-2 py-2 mt-1 font-sans"
                  >
                    <option value="Mobile Money">Mobile Money (MoMo)</option>
                    <option value="Cash">Cash Handover</option>
                    <option value="Bank Transfer">Bank Wire</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-mono font-bold" style={{ color: "var(--text-tertiary)" }}>Client Match</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="az-input w-full px-2 py-2 mt-1 font-sans"
                  >
                    <option value="">No customer link</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-mono font-bold" style={{ color: "var(--text-tertiary)" }}>Cashbook Statement description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Received partial retainer for project work"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="az-input w-full px-2.5 py-2.5 mt-1 font-sans"
                />
              </div>

              <button
                type="submit"
                className="az-btn az-btn-primary micro-press w-full py-2.5 mt-2"
              >
                Log Transaction
              </button>
            </form>
          )}

          {/* Outflow/Inflow log ledger index */}
          <div className="space-y-2">
            <span className="text-[9px] font-mono uppercase tracking-widest block font-bold mb-1" style={{ color: "var(--text-tertiary)" }}>Recent Ledger Logs</span>
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
              {activeTransactions.slice(0, 5).map((t) => (
                <div key={t.id} className="az-card-inset az-hover-lift p-3 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${t.type === "income" ? "az-chip-positive" : "az-chip-negative"}`}>
                      {t.type === "income" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold font-sans max-w-[140px] truncate" style={{ color: "var(--text-primary)" }}>{t.description}</h4>
                      <p className="text-[10px] font-mono tracking-wider" style={{ color: "var(--text-tertiary)" }}>{t.paymentMethod} — {t.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <strong className="font-mono font-bold" style={{ color: t.type === "income" ? "var(--positive)" : "var(--negative)" }}>
                      {t.type === "income" ? "+" : "-"}{currencySymbol}{t.amount.toLocaleString()}
                    </strong>
                    <button
                      onClick={() => onDeleteTransaction(t.id)}
                      className="transition-colors cursor-pointer hover:!text-rose-500"
                      style={{ color: "var(--text-tertiary)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {activeTransactions.length === 0 && (
                <EmptyState
                  compact
                  icon={History}
                  title="No transactions yet"
                  message='Nothing has been logged on this cashbook yet. Use the "+" button above to record your first income or expense.'
                />
              )}
            </div>
          </div>
        </div>

        {/* Database & Reports Utility - Mobile/Tablet only */}
        <div className="xl:hidden">{exportsPanel}</div>

      </div>

    </div>
  );
}
