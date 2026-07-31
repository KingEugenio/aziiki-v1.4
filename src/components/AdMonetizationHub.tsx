import React, { useState, useEffect } from "react";
import { DeviceMobile as Smartphone, BookOpen, Newspaper, FileText, Lightbulb, TrendUp as TrendingUp, CheckCircle, ChatCircle as MessageSquare, Clock, MagicWand as Sparkles, Megaphone, Envelope as Mail, Pulse as Activity, Trash as Trash2, CaretRight as ChevronRight, WarningCircle as AlertCircle } from "@phosphor-icons/react";
import { getFeatureAnalytics, clearFeatureAnalytics, FeatureUsage } from "../lib/analytics";
import { api, ApiError } from "../lib/api";

export default function AdMonetizationHub() {
  // Feature analytics state
  const [analytics, setAnalytics] = useState<FeatureUsage>(() => getFeatureAnalytics());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Success Story & Feedback Form state
  const [contactName, setContactName] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactMessage, setContactMessage] = useState<string>("");
  const [contactSubmitted, setContactSubmitted] = useState<boolean>(false);
  const [contactSubmitting, setContactSubmitting] = useState<boolean>(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Selected educational article modal
  const [selectedArticle, setSelectedArticle] = useState<number | null>(null);

  useEffect(() => {
    if (selectedArticle === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedArticle(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedArticle]);

  // Sync analytics state
  useEffect(() => {
    const interval = setInterval(() => {
      setAnalytics(getFeatureAnalytics());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setContactSubmitting(true);
    try {
      await api.feedback.submit({ name: contactName, email: contactEmail, message: contactMessage });
      setContactSubmitted(true);
      setTimeout(() => {
        setContactSubmitted(false);
        setContactName("");
        setContactEmail("");
        setContactMessage("");
      }, 5000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setContactError("Please sign in to submit feedback - guest sessions aren't saved to our team's inbox.");
      } else {
        setContactError(err instanceof ApiError ? err.message : "Something went wrong sending your feedback. Please try again.");
      }
    } finally {
      setContactSubmitting(false);
    }
  };

  const handleResetAnalytics = () => {
    const cleared = clearFeatureAnalytics();
    setAnalytics(cleared);
    setSuccessMsg("⚡ Workspace activity tracker has been safely reset.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const articles = [
    {
      id: 1,
      title: "Float Optimization: Best Practices for Mobile Money (MoMo) Cashflow Management",
      category: "Cashflow Management",
      readTime: "4 min read",
      summary: "Mobile Money represents the primary payment rails for West & East African retail. Managing float balance versus operational cash is crucial for daily liquidity.",
      content: `In modern African SME retail, Mobile Money accounts for over 80% of daily transactions. However, many business owners struggle with a fundamental liquidity trap: having high digital float but zero physical cash to pay local suppliers, or vice versa.

Key Float Strategy pillars:
1. **The Dual Ledger Rule**: Keep a clean separation between your cash-box and your digital wallets. Aziiki's digital ledger makes tracking easy; mark payment methods clearly as MoMo or Cash.
2. **Scheduled Liquidation**: Work with trusted local MoMo merchants or commercial bank deposit services to liquidate excess float into physical capital twice a week, minimizing overnight balance exposure.
3. **Float Buffer Reserve**: Retain a small, strict 10% reserve float buffer purely to fulfill customer withdrawal requests or process instant cash-backs without depleting active inventory capital.`
    },
    {
      id: 2,
      title: "The Invoice Strategy: How to Negotiate Prompt Payments and Minimize Credit Aging",
      category: "B2B Trade & Billing",
      readTime: "5 min read",
      summary: "Delaying collection blocks progress. Discover how to frame billing agreements, deploy digital quotes, and chase overdue accounts without damaging partner trust.",
      content: `Outstanding payments represent a silent killer for growing enterprises. When you extend supplier credit to commercial trade clients, you essentially act as an interest-free bank.

Effective Trade Invoicing pillars:
1. **Immediate Billing Cycle**: Never wait until the end of the month to send invoices. Draft and dispatch professional Aziiki invoices immediately upon product dispatch or service delivery.
2. **Explicit Late Fine Structures**: Establish clean 5% penalty clauses for payments exceeding 30 days. Displaying these terms clearly on your billing sheet reduces overdue periods by up to 40%.
3. **Automated Friendly Reminders**: Set a structured calendar sequence. Use Aziiki's customer CRM cards to log special client payment habits, and dispatch gentle WhatsApp invoice summaries 5 days before the official due date.`
    },
    {
      id: 3,
      title: "Inflation Hedging: Allocating Reserves in Local 91-Day Bills & Sovereign Debt",
      category: "Treasury & Wealth",
      readTime: "6 min read",
      summary: "Operating in a double-digit inflation market? Learn how to hedge offline business savings against local currency deprecation using high-yield secure treasuries.",
      content: `When operating in volatile macroeconomic landscapes (such as GHS or NGN networks), traditional bank checking accounts deplete your company's purchasing power due to inflation.

Sovereign SME Treasury pillars:
1. **Risk-Free Sovereign Paper**: High interest premiums, such as the Ghanaian Government 91-Day & 182-Day Treasury Bills, offer competitive risk-free returns. They are fully backed by national central banks and are easy to liquidate.
2. **The 3-Month Ladder Method**: Divide your idle cash reserve into three portions. Invest each portion in a rolling 91-day Treasury Bill spaced 30 days apart. This ensures you receive cash liquidations every single month while capturing top-tier interest rates.
3. **Stock Market Exposure**: Invest a small portion of long-term capital in blue-chip equities listed on local stock exchanges (like GSE or NGX) to capture capital growth that outperforms cash-box interest.`
    }
  ];

  return (
    <div id="unlock-premium-zone" className="space-y-6 text-slate-800 font-sans pb-12 select-none">
      
      {/* Top Welcome Title Banner */}
      <div className="bg-gradient-to-r from-brand-navy via-brand-teal to-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative max-w-3xl space-y-3">
          <span className="bg-brand-teal/20 text-brand-teal border border-brand-teal/30 text-[10px] font-mono tracking-widest uppercase font-black px-3 py-1 rounded-full inline-block">
            Launch Edition — 100% Free Workspace
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
            Aziiki Launch Hub — What's New & Updates
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-light">
            Welcome to the Launch Hub! Experience a generous, complete business operating system. Here, we track system enhancements, share expert business optimization advice, and compile feature analytics to help you streamline your SME operations.
          </p>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 animate-bounce shadow-sm font-sans text-xs">
          <CheckCircle className="w-5 h-5 text-brand-teal shrink-0" />
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {/* Main Grid Layout representing Updates, Analytics, & Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COMPONENT: Updates, Release Notes, & Analytics [7 Columns] */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Mobile App Private Beta Announcement */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden shadow-md">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-start gap-4">
              <div className="bg-white/10 text-white w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold shadow-inner shrink-0 mt-1">
                📱
              </div>
              <div className="space-y-2 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Beta Phase
                  </span>
                  <h4 className="text-base font-black tracking-tight">
                    Aziiki Mobile App is in Private Beta
                  </h4>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-light">
                  Our native smartphone application is currently undergoing secure private beta testing! Experience automated real-time MoMo SMS receipt parsing, instant offline database sync, inventory scanning via your phone camera, and instant WhatsApp invoice dispatch.
                </p>
                <div className="pt-2 flex items-center gap-4 text-[10px] text-indigo-300 font-mono">
                  <span>🚀 Launch Schedule: Q3 2027</span>
                  <span className="text-slate-500">|</span>
                  <span>Target: Android & iOS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Tips & Feature Spotlight */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm text-left">
            <div>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono tracking-widest uppercase font-bold px-2.5 py-0.5 rounded-md border border-emerald-200">
                Tips & Tricks
              </span>
              <h3 className="text-sm font-black text-slate-900 mt-1.5">
                Workspace Feature Highlights
              </h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs">
                <div className="p-2 bg-brand-teal/10 text-brand-teal rounded-xl shrink-0">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Mobile Money SMS Parser</h4>
                  <p className="text-[11px] text-slate-500 font-light mt-0.5 leading-relaxed">
                    Tired of manual ledger entry? Go to the <strong>Scorecard</strong>, copy-paste your MoMo receipt SMS directly into the Parser, and instantly register the amount, reference ID, category, and date!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Customize Your Corporate Brand</h4>
                  <p className="text-[11px] text-slate-500 font-light mt-0.5 leading-relaxed">
                    On the <strong>Billing & PDFs</strong> tab, expand the <em>"Edit Issuer Brand Info"</em> section to instantly replace our placeholder details with your actual corporate logo emoji, WhatsApp contact, and registration logs.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs">
                <div className="p-2 bg-brand-amber/10 text-amber-600 rounded-xl shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">Live Sovereign Rates Grounding</h4>
                  <p className="text-[11px] text-slate-500 font-light mt-0.5 leading-relaxed">
                    Toggle your active business currency (GHS, NGN, KES). Aziiki's wealth module connects directly with Central Bank intelligence to fetch the absolute latest Treasury Bill rates and local market inflation parameters.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Launch Activity Diagnostics (Background Analytics presentation) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm text-left">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-start gap-4">
              <div>
                <span className="text-[9px] bg-indigo-50 text-indigo-600 font-mono tracking-widest uppercase font-black px-2 py-0.5 rounded-md border border-indigo-100">
                  System Diagnostics
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-1.5 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-brand-teal" />
                  Workspace Activity & Diagnostics Tracker
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-light">
                  This tracker lists total system interactions recorded in your active browser session. Rest assured, your telemetry logs are stored securely.
                </p>
              </div>

              <button
                onClick={handleResetAnalytics}
                className="p-1.5 hover:bg-slate-100 text-slate-450 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                title="Reset Analytics Tracker" aria-label="Reset Analytics Tracker"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Documents Compiled</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-black text-slate-900">
                    {analytics.invoicesCreated + analytics.receiptsCreated + analytics.estimatesCreated}
                  </span>
                  <span className="text-[10px] text-brand-teal font-medium">Invoices / Receipts / Quotes</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-brand-teal h-full" style={{ width: `${Math.min(100, ((analytics.invoicesCreated + analytics.receiptsCreated + analytics.estimatesCreated) / 15) * 100)}%` }}></div>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">AI Strategist Audits</span>
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-black text-slate-900">
                    {analytics.aiQueries}
                  </span>
                  <span className="text-[10px] text-indigo-500 font-medium">Gemini CFO Consults</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(100, (analytics.aiQueries / 10) * 100)}%` }}></div>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-light">Invoices drafted</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                  {analytics.invoicesCreated}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-light">Customer CRM Logs</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                  {analytics.crmProfilesAdded}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-light">Inventory Adjustments</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                  {analytics.inventoryAdjusted}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500 font-light">Wisdom Reports Pulled</span>
                <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded-md text-[10px]">
                  {analytics.reportsGenerated}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COMPONENT: Growth Articles & User Feedback Form [5 Columns] */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Business Growth & Strategy Articles */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm text-left">
            <div>
              <span className="text-[9px] bg-brand-navy/10 text-brand-navy font-mono tracking-widest uppercase font-bold px-2 py-0.5 rounded-md border border-slate-200">
                Academy & Strategy
              </span>
              <h3 className="text-sm font-black text-slate-900 mt-1.5">
                Business Growth Academy
              </h3>
            </div>

            <div className="space-y-3">
              {articles.map((art) => (
                <div 
                  key={art.id}
                  onClick={() => setSelectedArticle(art.id)}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-2.5 group"
                >
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-mono font-bold text-brand-teal">
                      <span>{art.category}</span>
                      <span className="text-slate-400">{art.readTime}</span>
                    </div>
                    <h4 className="font-extrabold text-xs text-slate-900 leading-snug group-hover:text-brand-teal transition-colors">
                      {art.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-light leading-normal line-clamp-2">
                      {art.summary}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1 group-hover:translate-x-1 transition-transform self-start">
                    Read Article <ChevronRight className="w-3.5 h-3.5 text-brand-teal" />
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* User Feedback & Success Stories Form */}
          <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 space-y-6 shadow-sm relative overflow-hidden text-left">
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none -mr-20 -mb-20"></div>

            <div className="border-b border-slate-800 pb-3">
              <span className="text-[9px] bg-brand-teal/25 text-brand-teal font-mono tracking-widest uppercase font-black px-2.5 py-1 rounded-md border border-brand-teal/20">
                Community Hub
              </span>
              <h3 className="text-base font-black text-white mt-2 flex items-center gap-2">
                <Megaphone className="w-4.5 h-4.5 text-brand-teal" />
                Share Feedback & Success Stories
              </h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-normal font-light">
                We're building the future of African business intelligence. Share your system feedback, success stories, or feature suggestions directly with our team!
              </p>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-3.5 text-xs">
              {contactSubmitted ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3.5 rounded-xl flex items-start gap-2.5 animate-fade-in">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[11px] block font-extrabold">Message Processed!</strong>
                    <p className="text-[10px] font-light mt-0.5 text-slate-400">
                      Thank you for your valuable feedback. Your message has been sent to the product review desk.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {contactError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl flex items-start gap-2 animate-fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-[10.5px] font-semibold leading-relaxed">{contactError}</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Your Name / Business</label>
                    <input 
                      required
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="e.g. Kwame Mensah Enterprise"
                      className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl p-2.5 outline-none focus:border-brand-teal transition-colors font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Your Contact Email</label>
                    <input 
                      required
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="kwame@enterprise.com"
                      className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl p-2.5 outline-none focus:border-brand-teal transition-colors font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Feedback or Success Story</label>
                    <textarea 
                      required
                      rows={3}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Tell us how Aziiki has helped your business or what additional tools you would love to see..."
                      className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl p-2.5 outline-none focus:border-brand-teal transition-colors font-sans"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={contactSubmitting}
                    className="w-full bg-brand-teal hover:bg-emerald-700 text-white font-extrabold uppercase tracking-wider py-3 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="w-3.5 h-3.5 text-emerald-200" />
                    {contactSubmitting ? "Sending..." : "Submit Feedback"}
                  </button>
                </>
              )}
            </form>

            <div className="pt-2 border-t border-slate-800 text-center">
              {/* TODO: replace with Aziiki's official support email before launch */}
              <span className="text-[10px] text-slate-400 font-mono">
                Direct Route: <a href="mailto:support@aziiki.com" className="text-emerald-400 hover:underline">support@aziiki.com</a>
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* ARTICLE READER MODAL OVERLAY */}
      {selectedArticle !== null && (
        <div role="dialog" aria-modal="true" aria-label="Article" className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in select-none text-left">
          <div className="bg-white text-slate-800 border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full relative space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={() => setSelectedArticle(null)}
              aria-label="Close"
              className="absolute top-4 right-4 w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer font-bold"
            >
              ✕
            </button>

            {(() => {
              const art = articles.find(a => a.id === selectedArticle);
              if (!art) return null;
              return (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-full inline-block">
                      {art.category}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                      {art.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {art.readTime} • Published for Aziiki Workspace
                    </span>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="text-xs sm:text-xs leading-relaxed text-slate-600 font-light space-y-3 whitespace-pre-line">
                    {art.content}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setSelectedArticle(null)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white font-extrabold text-[11px] rounded-xl transition-all cursor-pointer"
                    >
                      Close Article
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

    </div>
  );
}
