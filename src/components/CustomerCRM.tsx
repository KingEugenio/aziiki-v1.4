import React, { useState } from "react";
import { User, Phone, Envelope as Mail, Plus, Trash as Trash2, CaretRight as ChevronRight, MagnifyingGlass as Search, ChatCircle as MessageSquare, CheckCircle, WarningCircle as AlertCircle, FileCsv as FileSpreadsheet, Buildings as Building, CurrencyDollar as DollarSign } from "@phosphor-icons/react";
import { Customer, Invoice, Transaction, Business } from "../types";
import { SUPPORTED_CURRENCY_CODES } from "../lib/currency";
import EmptyState from "./errors/EmptyState";

interface CustomerCRMProps {
  currentBusiness: Business;
  customers: Customer[];
  invoices: Invoice[];
  transactions: Transaction[];
  currencySymbol: string;
  onAddCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
}

export default function CustomerCRM({
  currentBusiness,
  customers,
  invoices,
  transactions,
  currencySymbol,
  onAddCustomer,
  onDeleteCustomer
}: CustomerCRMProps) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || "");
  const [isAddingCustomer, setIsAddingCustomer] = useState<boolean>(false);
  const [notif, setNotif] = useState<string | null>(null);

  // Bulk CSV States
  const [showBulkImport, setShowBulkImport] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Form value states
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [category, setCategory] = useState<"Creative Client" | "Enterprise" | "Retainer Account">("Creative Client");
  const [preferredCurrency, setPreferredCurrency] = useState<string>("");

  const businessCustomers = customers.filter(c => c.businessId === currentBusiness.id);

  const handleParseCustomerCSV = (text: string) => {
    try {
      const lines = text.split("\n");
      if (lines.length < 2) {
        setCsvError("CSV error: Must contain a header row and at least one contact row.");
        return;
      }

      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"(.*)"$/, '$1').trim());
        const custName = cols[0];
        if (!custName) continue;

        const custEmail = cols[1] || "info@client-enterprise.com";
        const custPhone = cols[2] || "+233 24...";
        const custNotes = cols[3] || "Auto-registered bulk CRM partner.";
        const custCategory = (cols[4] as any) || "Creative Client";

        onAddCustomer({
          id: "cust-csv-" + Math.random().toString(36).substr(2, 9),
          name: custName,
          email: custEmail,
          phone: custPhone,
          notes: custNotes,
          category: custCategory,
          businessId: currentBusiness.id,
          avatarColor: "blue"
        });
        count++;
      }

      setCsvError(null);
      setNotif(`Loaded ${count} bulk contacts successfully!`);
      setShowBulkImport(false);
      setTimeout(() => setNotif(null), 4000);
    } catch (e: any) {
      setCsvError(`Errors during load: ${e.message}`);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleParseCustomerCSV(text);
      };
      reader.readAsText(file);
    } else {
      setCsvError("Error: Dropped file must be a valid .csv format!");
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const filteredCustomers = businessCustomers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCust: Customer = {
      id: "cust-" + Math.random().toString(36).substr(2, 9),
      name,
      email: email || "info@client-enterprise.com",
      phone: phone || "+233 24...",
      notes: "Auto-registered SME partner profile.",
      category,
      businessId: currentBusiness.id,
      avatarColor: "blue",
      preferredCurrency: preferredCurrency || undefined,
    };

    onAddCustomer(newCust);
    setSelectedCustomerId(newCust.id);
    setName("");
    setEmail("");
    setPhone("");
    setPreferredCurrency("");
    setIsAddingCustomer(false);
    
    setNotif(`Profile for ${newCust.name} added successfully.`);
    setTimeout(() => setNotif(null), 3000);
  };

  // Dynamic customer health metrics calculation
  const getCustomerMetrics = (cId: string) => {
    const custInvoices = invoices.filter(i => i.customerId === cId && i.businessId === currentBusiness.id);
    const completedTransactions = transactions.filter(t => t.customerId === cId && t.businessId === currentBusiness.id);

    const totalBilled = custInvoices.reduce((sum, inv) => {
      const subtotal = inv.items.reduce((acc, item) => acc + (item.quantity * item.rate), 0);
      const tax = (subtotal * inv.taxRate) / 100;
      const disc = (subtotal * inv.discount) / 100;
      return sum + (subtotal + tax - disc);
    }, 0);

    const totalSettled = completedTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const outstandingBalance = Math.max(0, totalBilled - totalSettled);

    return {
      billed: totalBilled,
      settled: totalSettled,
      balance: outstandingBalance,
      invoiceCount: custInvoices.length
    };
  };

  // WhatsApp reminder generator
  const triggerReminder = (cust: Customer, bal: number) => {
    const textMsg = `Hello ${cust.name},\n\nThis is a friendly statement update from ${currentBusiness.name}. Our files show an outstanding ledger statement balance of ${currencySymbol}${bal.toLocaleString()}.\n\nThank you for working with local SME partners!`;
    const shareUrl = `https://wa.me/${cust.phone.replace(/[+\s]/g, "")}?text=${encodeURIComponent(textMsg)}`;
    window.open(shareUrl, "_blank");
  };

  return (
    <div id="customer-crm-root" className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 font-sans" style={{ color: "var(--text-primary)" }}>

      {/* LEFT: Customer List Panel Column */}
      <div className="lg:col-span-4 az-card az-elevation-1 p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg az-chip-accent shrink-0">
              <Building className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold font-sans" style={{ color: "var(--text-primary)" }}>
                SME Accounts Directory
              </h3>
              <p className="text-[11px] font-sans mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Clients registered under {currentBusiness.name}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            id="crm-add-client-btn"
            onClick={() => {
              setIsAddingCustomer(!isAddingCustomer);
              setShowBulkImport(false);
            }}
            className="az-btn az-btn-secondary micro-press flex-1 justify-center text-[11px] py-2"
          >
            <Plus className="w-3.5 h-3.5" /> Register
          </button>
          <button
            onClick={() => {
              setShowBulkImport(!showBulkImport);
              setIsAddingCustomer(false);
            }}
            className="az-btn az-btn-secondary micro-press flex-1 justify-center text-[11px] py-2"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Bulk CSV
          </button>
        </div>

        {/* Search Input bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3" style={{ color: "var(--text-tertiary)" }} />
          <input
            id="crm-search-input"
            type="text"
            placeholder="Search accounts directory..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="az-input w-full pl-9 pr-4 py-2.5 text-xs font-sans"
          />
        </div>

        {notif && (
          <div className="az-chip-positive text-[11px] p-2.5 rounded-xl font-sans">
            ✓ {notif}
          </div>
        )}

        {/* Bulk CSV Importer */}
        {showBulkImport && (
          <div className="az-card-inset rounded-xl p-4 space-y-4 text-xs animate-slide-up leading-relaxed">
            <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: "var(--border-subtle)" }}>
              <h4 className="font-bold font-sans flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
                <FileSpreadsheet className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Bulk Import CSV Contacts
              </h4>
              <button
                onClick={() => setShowBulkImport(false)}
                aria-label="Close"
                className="font-bold cursor-pointer"
                style={{ color: "var(--text-tertiary)" }}
              >
                ✕
              </button>
            </div>

            <p className="text-[10px] leading-tight font-sans" style={{ color: "var(--text-secondary)" }}>
              Expected column order (or comma-separated):<br/>
              <code className="px-1 border rounded text-[9.5px] font-mono" style={{ background: "var(--surface-card)", borderColor: "var(--border-subtle)" }}>name, email, phone, notes, category</code>
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer"
              style={dragOver
                ? { borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 8%, var(--surface-card))" }
                : { borderColor: "var(--border-default)", background: "var(--surface-card)" }}
            >
              <FileSpreadsheet className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
                Drag and drop your contacts.csv file here
              </p>
              <p className="text-[9px] mt-1 font-sans" style={{ color: "var(--text-tertiary)" }}>
                Or click browse below to select a local file
              </p>

              <label className="az-btn az-btn-secondary micro-press mt-3 inline-flex text-[10px] py-1 px-3 cursor-pointer">
                Browse File
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        handleParseCustomerCSV(text);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {csvError && (
              <p className="az-chip-negative text-[10px] font-semibold font-mono p-2 rounded-lg">
                {csvError}
              </p>
            )}
          </div>
        )}

        {/* Add customer form */}
        {isAddingCustomer && (
          <form onSubmit={handleSaveCustomer} className="az-card-inset rounded-xl p-4 space-y-3.5 text-xs animate-slide-up leading-relaxed">
            <h4 className="font-bold font-sans border-b pb-2" style={{ color: "var(--text-primary)", borderColor: "var(--border-subtle)" }}>New Account Record</h4>

            <div>
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Company / Customer Name</label>
              <input
                id="param-customer-name"
                type="text"
                required
                placeholder="e.g. Alaba Fabrics Ltd"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="az-input w-full px-2.5 py-1.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-mono font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Mobile Carrier Phone</label>
                <input
                  type="text"
                  placeholder="+233 24 123..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="az-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Email Statement Address</label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="az-input w-full px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Account Class Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="az-input w-full px-2 py-1.5 text-xs cursor-pointer"
              >
                <option value="Creative Client">Creative Services Client</option>
                <option value="Enterprise">SME / Corporate Account</option>
                <option value="Retainer Account">Retainer Contract Client</option>
              </select>
            </div>

            <div>
              <label className="text-[9px] font-mono font-bold uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>
                Preferred Currency (optional)
              </label>
              <select
                value={preferredCurrency}
                onChange={(e) => setPreferredCurrency(e.target.value)}
                className="az-input w-full px-2 py-1.5 text-xs cursor-pointer"
              >
                <option value="">Use this business's default currency</option>
                {SUPPORTED_CURRENCY_CODES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="az-btn az-btn-primary micro-press w-full justify-center py-2.5 text-xs tracking-wide"
            >
              Verify & Log Account
            </button>
          </form>
        )}

        {/* Customer Accounts directory listings */}
        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
          {filteredCustomers.map((cust) => {
            const m = getCustomerMetrics(cust.id);
            const isSelected = cust.id === selectedCustomerId;

            return (
              <button
                key={cust.id}
                onClick={() => setSelectedCustomerId(cust.id)}
                className={`w-full p-3 text-left rounded-xl flex items-center justify-between border transition-all cursor-pointer font-sans text-xs az-hover-lift ${isSelected ? "font-bold" : "font-normal"}`}
                style={isSelected
                  ? { background: "color-mix(in srgb, var(--accent) 10%, var(--surface-card))", borderColor: "var(--accent)", color: "var(--text-primary)" }
                  : { background: "transparent", borderColor: "transparent", color: "var(--text-secondary)" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg shrink-0" style={isSelected ? { background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent-strong)" } : { background: "var(--surface-card-2)", color: "var(--text-tertiary)" }}>
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold block truncate max-w-[150px]" style={{ color: "var(--text-primary)" }}>{cust.name}</h4>
                    <span className="text-[10px] block font-normal mt-0.5" style={{ color: "var(--text-tertiary)" }}>{cust.category}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <strong className="font-mono text-xs block" style={m.balance > 0 ? { color: "var(--warning)", fontWeight: 800 } : { color: "var(--positive)" }}>
                    {currencySymbol}{m.balance.toLocaleString()}
                  </strong>
                  <span className="text-[9px] block font-normal mt-0.5" style={{ color: "var(--text-tertiary)" }}>Bal Due</span>
                </div>
              </button>
            );
          })}
          {filteredCustomers.length === 0 && (
            <EmptyState
              compact
              icon={User}
              title={searchTerm ? "No matches found" : "No customers yet"}
              message={searchTerm ? "Try a different name, email, or phone number." : "Register your first customer to start tracking invoices and balances for them."}
              action={!searchTerm ? { label: "Register a customer", onClick: () => setIsAddingCustomer(true) } : undefined}
            />
          )}
        </div>
      </div>

      {/* RIGHT: Selected Customer Detail Panel */}
      <div className="lg:col-span-8">
        {selectedCustomer ? (
          (() => {
            const metrics = getCustomerMetrics(selectedCustomer.id);

            return (
              <div className="az-card az-elevation-1 p-4 sm:p-6 space-y-6">

                {/* Profile Header card summary */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b pb-5" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full text-lg font-bold flex items-center justify-center font-mono shrink-0" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--surface-card))", border: "1px solid color-mix(in srgb, var(--accent) 25%, var(--border-subtle))", color: "var(--accent-strong)" }}>
                      {selectedCustomer.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-sans" style={{ color: "var(--text-primary)" }}>{selectedCustomer.name}</h3>
                      <span className="az-chip-accent text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-widest mt-1 inline-block">
                        {selectedCustomer.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerReminder(selectedCustomer, metrics.balance)}
                      disabled={metrics.balance <= 0}
                      className="az-btn az-btn-primary micro-press text-[11px] px-3.5 py-2 disabled:opacity-40"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Prompt Statement Ledger
                    </button>

                    <button
                      onClick={() => onDeleteCustomer(selectedCustomer.id)}
                      className="az-chip-negative p-2 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Grid info contact fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                  <div className="az-card-inset p-3 rounded-xl flex items-center gap-2.5">
                    <Phone className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest block" style={{ color: "var(--text-tertiary)" }}>WhatsApp Carrier Channel</span>
                      <strong style={{ color: "var(--text-primary)" }}>{selectedCustomer.phone}</strong>
                    </div>
                  </div>
                  <div className="az-card-inset p-3 rounded-xl flex items-center gap-2.5">
                    <Mail className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                    <div>
                      <span className="text-[9px] font-mono uppercase tracking-widest block" style={{ color: "var(--text-tertiary)" }}>Email Statement Target</span>
                      <strong style={{ color: "var(--text-primary)" }}>{selectedCustomer.email}</strong>
                    </div>
                  </div>
                </div>

                {/* Consolidated Balance summaries widgets */}
                <div className="flex sm:grid sm:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto custom-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
                  <div className="az-card-inset shrink-0 w-[42vw] sm:w-auto p-4 rounded-xl text-center">
                    <span className="text-[9px] font-mono uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Invoice billing</span>
                    <strong className="font-mono text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{currencySymbol}{metrics.billed.toLocaleString()}</strong>
                  </div>
                  <div className="az-card-inset shrink-0 w-[42vw] sm:w-auto p-4 rounded-xl text-center">
                    <span className="text-[9px] font-mono uppercase tracking-widest block mb-1" style={{ color: "var(--text-tertiary)" }}>Settled payments</span>
                    <strong className="font-mono text-sm leading-relaxed" style={{ color: "var(--positive)" }}>{currencySymbol}{metrics.settled.toLocaleString()}</strong>
                  </div>
                  <div className="az-chip-warning shrink-0 w-[42vw] sm:w-auto p-4 rounded-xl text-center">
                    <span className="text-[9px] font-mono uppercase tracking-widest block mb-1 opacity-80">Remaining Balance</span>
                    <strong className="font-mono text-sm leading-relaxed">{currencySymbol}{metrics.balance.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Customer specific recent activity transactions ledger */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-widest font-sans" style={{ color: "var(--text-tertiary)" }}>
                    Customer Ledger Statements Activity
                  </h4>

                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {transactions
                      .filter(t => t.customerId === selectedCustomer.id && t.businessId === currentBusiness.id)
                      .map(t => (
                        <div key={t.id} className="az-card-inset rounded-xl p-3 flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="az-chip-positive text-[10px] font-mono p-1 rounded font-bold">{t.paymentMethod}</span>
                            <div>
                              <p className="font-semibold font-sans" style={{ color: "var(--text-primary)" }}>{t.description}</p>
                              <span className="text-[9px] block mt-0.5" style={{ color: "var(--text-tertiary)" }}>{t.date}</span>
                            </div>
                          </div>
                          <strong className="font-semibold font-mono" style={{ color: "var(--positive)" }}>
                            +{currencySymbol}{t.amount.toLocaleString()}
                          </strong>
                        </div>
                      ))}
                    {transactions.filter(t => t.customerId === selectedCustomer.id && t.businessId === currentBusiness.id).length === 0 && (
                      <div className="text-center py-6 italic text-[11px] font-sans border border-dashed rounded-xl" style={{ color: "var(--text-tertiary)", borderColor: "var(--border-default)" }}>
                        No settled mobile money logs mapped under this specific client. Get invoices settled to fill historical logs!
                      </div>
                    )}
                  </div>
                </div>

              </div>
            );
          })()
        ) : (
          <div className="az-card az-elevation-1 p-12 sm:p-16 text-center italic text-xs font-sans" style={{ color: "var(--text-tertiary)" }}>
            Select or register a client account profile from the sidebar to inspect consolidated ledger activities.
          </div>
        )}
      </div>

    </div>
  );
}
