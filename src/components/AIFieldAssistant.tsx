import React, { useState } from "react";
import { Brain as BrainCircuit, MagicWand as Sparkles, Warning as AlertTriangle, TrendUp as TrendingUp, CurrencyDollar as DollarSign, Calendar, TrendDown as TrendingDown, ArrowUpRight, PaperPlaneTilt as Send, CircleNotch as Loader, ChatCircle as MessageSquare, Sparkle, Target } from "@phosphor-icons/react";
import { Transaction, Invoice, Goal, Business } from "../types";

interface AIFieldAssistantProps {
  currentBusiness: Business;
  transactions: Transaction[];
  invoices: Invoice[];
  goals: Goal[];
  currencySymbol: string;
}

interface Message {
  sender: "user" | "cfo";
  text: string;
}

export default function AIFieldAssistant({
  currentBusiness,
  transactions,
  invoices,
  goals,
  currencySymbol
}: AIFieldAssistantProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [diagnosed, setDiagnosed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Custom chat messaging states
  const [userQuery, setUserQuery] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { sender: "cfo", text: "Hello! I am your Aziiki field assistant. I have cross-examined your mobile money ledger entries, capital target milestones, and VAT invoicing files. What strategic assistance or growth scenario planning shall we evaluate today?" }
  ]);

  // Aggregate insights for query payloads
  const [insights, setInsights] = useState<{
    growthDiagnosis: string;
    actionSteps: string[];
    riskRating: "Low" | "Medium" | "High";
    hedgingTactics: string;
  } | null>(null);

  const totalRevenue = transactions
    .filter(t => t.type === "income" && t.businessId === currentBusiness.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === "expense" && t.businessId === currentBusiness.id)
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalRevenue - totalExpenses;

  const outstandingInvoices = invoices
    .filter(inv => inv.businessId === currentBusiness.id && (inv.status === "Sent" || inv.status === "Overdue"))
    .reduce((sum, inv) => {
      const invTotal = inv.items.reduce((acc, current) => acc + (current.quantity * current.rate), 0);
      const taxAmount = (invTotal * inv.taxRate) / 100;
      const discountAmount = (invTotal * inv.discount) / 100;
      return sum + (invTotal + taxAmount - discountAmount - inv.partialPaidAmount);
    }, 0);

  const triggerDiagnosis = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: currentBusiness.name,
          currency: currentBusiness.currency,
          totalRevenue,
          totalExpenses,
          netProfit,
          outstandingInvoices,
          recentTransactions: transactions.filter(t => t.businessId === currentBusiness.id).slice(0, 10),
          userQuery: userQuery
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to parse CFO predictions.");
      }

      setInsights(data);
      setDiagnosed(true);
      
      if (data.aiReply) {
        setChatMessages(prev => [
          ...prev,
          { sender: "cfo", text: data.aiReply }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Something took an unexpected turn with the AI processor.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    const messageText = userQuery;
    setChatMessages(prev => [...prev, { sender: "user", text: messageText }]);
    setUserQuery("");

    setLoading(true);
    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: currentBusiness.name,
          currency: currentBusiness.currency,
          totalRevenue,
          totalExpenses,
          netProfit,
          outstandingInvoices,
          recentTransactions: transactions.filter(t => t.businessId === currentBusiness.id).slice(0, 10),
          userQuery: messageText
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI took an wrong detour.");
      
      if (data.aiReply) {
        setChatMessages(prev => [
          ...prev,
          { sender: "cfo", text: data.aiReply }
        ]);
      }
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { sender: "cfo", text: "Apologies, my system connection timed out. Please double-check your Gemini API Key in the settings panel." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const appGuides = [
    { title: "🎨 How to customize Brand?", query: "How do I edit and customize my Company logo, name, and currency? Where does this info sync on my PDF receipts? Also what database is used?" },
    { title: "📥 How does the SMS Parser work?", query: "Can you explain step-by-step how to use the Mobile Money SMS receipt auto-filler?" },
    { title: "📄 How to print PDF invoices?", query: "How do I customize and create brand invoices and quote estimates? How do WhatsApp pay links work?" },
    { title: "📈 What are sovereign yields?", query: "How can I track the live T-bill interest rates using the search grounding tool on Bank of Ghana and Central Bank of Nigeria?" }
  ];

  const handleQuickQuestion = async (queryText: string) => {
    setChatMessages(prev => [...prev, { sender: "user", text: `Guide: ${queryText}` }]);
    setLoading(true);
    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: currentBusiness.name,
          currency: currentBusiness.currency,
          totalRevenue,
          totalExpenses,
          netProfit,
          outstandingInvoices,
          recentTransactions: transactions.filter(t => t.businessId === currentBusiness.id).slice(0, 10),
          userQuery: queryText
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI took an wrong detour.");
      
      if (data.aiReply) {
        setChatMessages(prev => [
          ...prev,
          { sender: "cfo", text: data.aiReply }
        ]);
      }
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { sender: "cfo", text: "Apologies, my system connection timed out. Please double-check your Gemini API Key in the settings panel." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai-assistant-container" className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 font-sans" style={{ color: "var(--text-primary)" }}>

      {/* LEFT: Business Diagnostic Cockpit Card */}
      <div className="lg:col-span-5 az-card az-elevation-1 p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg az-chip-accent shrink-0">
            <BrainCircuit className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold font-sans" style={{ color: "var(--text-primary)" }}>
              CFO Diagnostic Desk
            </h3>
            <p className="text-[11px] font-sans mt-0.5" style={{ color: "var(--text-secondary)" }}>
              AI-driven audit telemetry based on active GHS ledger balances.
            </p>
          </div>
        </div>

        {/* Dynamic Diagnostics visual boxes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="az-card-inset p-3 rounded-xl">
            <span className="text-[9px] font-mono block tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>Current Liquidity</span>
            <strong className="text-sm font-extrabold font-mono mt-1 block" style={{ color: "var(--positive)" }}>
              {currencySymbol}{netProfit.toLocaleString()}
            </strong>
          </div>
          <div className="az-card-inset p-3 rounded-xl">
            <span className="text-[9px] font-mono block tracking-widest uppercase" style={{ color: "var(--text-tertiary)" }}>Overdue Collections</span>
            <strong className="text-sm font-extrabold font-mono mt-1 block" style={{ color: "var(--warning)" }}>
              {currencySymbol}{outstandingInvoices.toLocaleString()}
            </strong>
          </div>
        </div>

        {errorMessage && (
          <div className="az-chip-negative p-3.5 rounded-xl text-xs flex items-start gap-2 animate-slide-up font-sans">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Execution Warning</p>
              <p className="text-[11px] opacity-90 leading-relaxed mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <button
          onClick={triggerDiagnosis}
          disabled={loading}
          className="az-btn az-btn-primary micro-press w-full justify-center py-3 text-xs"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Scanning Company Ledgers...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Calibrate Growth Diagnosis
            </>
          )}
        </button>

        {/* Diagnostic Results Card / Skeleton Loader */}
        {loading && !insights ? (
          <div className="az-card-inset rounded-xl p-4 space-y-4 animate-pulse">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="h-4 rounded w-1/3" style={{ background: "var(--border-default)" }}></div>
              <div className="h-4 rounded w-1/5" style={{ background: "var(--border-default)" }}></div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="h-3.5 rounded w-1/2" style={{ background: "var(--border-default)" }}></div>
                <div className="h-3 rounded w-full" style={{ background: "var(--border-subtle)" }}></div>
                <div className="h-3 rounded w-11/12" style={{ background: "var(--border-subtle)" }}></div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3.5 rounded w-2/5" style={{ background: "var(--border-default)" }}></div>
                <div className="h-3 rounded w-5/6" style={{ background: "var(--border-subtle)" }}></div>
              </div>
              <div className="space-y-1.5">
                <div className="h-3.5 rounded w-1/3" style={{ background: "var(--border-default)" }}></div>
                <div className="h-3 rounded w-2/3" style={{ background: "var(--border-subtle)" }}></div>
              </div>
            </div>
          </div>
        ) : diagnosed && insights ? (
          <div className="az-card-inset rounded-xl p-4 space-y-4 text-xs leading-relaxed animate-slide-up">
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border-subtle)" }}>
              <span className="font-sans font-bold block flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
                <Sparkle className="w-4 h-4" style={{ color: "var(--accent)" }} /> Executive Scenarios
              </span>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${insights.riskRating === "High" ? "az-chip-negative" : "az-chip-positive"}`}>
                RISK: {insights.riskRating || "Medium"}
              </span>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <strong className="block mb-0.5" style={{ color: "var(--text-primary)" }}>Stability Vector Index:</strong>
                <p style={{ color: "var(--text-secondary)" }}>{insights.growthDiagnosis}</p>
              </div>

              <div>
                <strong className="block mb-0.5" style={{ color: "var(--text-primary)" }}>Mitigation Guardrails:</strong>
                <p style={{ color: "var(--text-secondary)" }}>{insights.hedgingTactics}</p>
              </div>

              <div>
                <strong className="block mb-1" style={{ color: "var(--text-primary)" }}>Immediate Prioritized Objectives:</strong>
                <ul className="space-y-1 list-disc list-inside" style={{ color: "var(--text-secondary)" }}>
                  {insights.actionSteps?.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-[11px] font-sans leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          The CFO intelligent advisor executes real-time simulations over GHS interest rate positions, supplier debt schedules, inflation projections, and customer receivables.
        </p>
      </div>

      {/* RIGHT: Chat Room Interactive Canvas */}
      <div className="lg:col-span-7 az-card az-elevation-1 p-4 sm:p-5 flex flex-col justify-between h-[480px]">

        {/* Chat Room header */}
        <div className="flex items-center justify-between border-b pb-3 mb-3 shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-2">
            <div className="az-chip-accent p-2 rounded-xl">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold font-sans text-xs" style={{ color: "var(--text-primary)" }}>Simulate Inflation Scenarios</h4>
              <p className="text-[10px] font-mono tracking-wide mt-0.5" style={{ color: "var(--text-tertiary)" }}>AI Engine Level Active</p>
            </div>
          </div>
        </div>

        {/* Message Logs Area scrollable */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 custom-scrollbar text-xs leading-relaxed font-sans">
          {chatMessages.map((msg, idx) => {
            const isCfo = msg.sender === "cfo";

            return (
              <div
                key={idx}
                className={`flex ${isCfo ? "justify-start" : "justify-end"}`}
              >
                <div
                  className="max-w-[85%] rounded-xl p-3.5 border font-sans"
                  style={isCfo
                    ? { background: "var(--surface-card)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }
                    : { background: "color-mix(in srgb, var(--accent) 12%, var(--surface-card))", borderColor: "color-mix(in srgb, var(--accent) 30%, var(--border-subtle))", color: "var(--text-primary)", fontWeight: 600 }}
                >
                  <p>{msg.text}</p>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start w-full max-w-[85%] animate-pulse">
              <div className="az-card-inset rounded-xl p-3.5 w-full space-y-2">
                <div className="flex items-center gap-1.5 mb-1 font-medium" style={{ color: "var(--text-tertiary)" }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--accent)" }}></div>
                  <span className="text-[10px] font-mono uppercase tracking-wider">Aziiki AI Computing...</span>
                </div>
                <div className="h-3 rounded w-full" style={{ background: "var(--border-default)" }}></div>
                <div className="h-3 rounded w-11/12" style={{ background: "var(--border-default)" }}></div>
                <div className="h-3 rounded w-4/5" style={{ background: "var(--border-default)" }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Quick App Guide Presets */}
        <div className="mt-3.5 pt-2.5 border-t shrink-0" style={{ borderColor: "var(--border-subtle)" }}>
          <span className="text-[9px] font-mono block mb-1.5 uppercase font-bold tracking-wider text-left" style={{ color: "var(--text-tertiary)" }}>💡 Tap to ask how Aziiki works (Gemini AI Guide):</span>
          <div className="flex flex-wrap gap-1.5 max-h-[70px] overflow-y-auto">
            {appGuides.map((g, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => handleQuickQuestion(g.query)}
                className="az-btn az-btn-secondary micro-press px-2.5 py-1 text-[10px] font-medium"
              >
                {g.title}
              </button>
            ))}
          </div>
        </div>

        {/* Direct typing send bar */}
        <form onSubmit={handleSendMessage} className="pt-2 flex items-center gap-2 shrink-0">
          <input
            type="text"
            required
            placeholder="Ask about Mobile Money integration, inflation, or tax compliance..."
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            className="az-input flex-1 px-4 py-2.5 text-xs font-sans"
          />
          <button
            type="submit"
            disabled={loading}
            className="az-btn az-btn-primary micro-press rounded-xl p-2.5 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

    </div>
  );
}
