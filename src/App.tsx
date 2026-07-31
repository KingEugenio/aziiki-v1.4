import React, { useState, useEffect, useMemo, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Buildings as Building2, Stack as Layers2, Coins, Users, Target, Warehouse, Brain as BrainCircuit, MagicWand as Sparkles, CurrencyDollar as DollarSign, DeviceMobile as Smartphone, CheckCircle, TrendUp as TrendingUp, WarningCircle as AlertCircle, Database, ShieldCheck, SignOut as LogOut, UserCheck, ChartLine as LineChart, BookOpen } from "@phosphor-icons/react";
import { Business, Customer, Transaction, Invoice, Receipt, Quotation, Investment, Asset, Goal, Debt, InventoryItem, Partner, Shareholder, UserRole, AuditLog } from "./types";
import BusinessDashboard from "./components/BusinessDashboard";
import { Skeleton, SkeletonDashboard, SkeletonTable, SkeletonDetail, SkeletonForm } from "./components/Skeleton";
import { useMinimumLoadingTime } from "./hooks/useMinimumLoadingTime";
import Logo from "./components/Logo";
import NotificationBanner from "./components/NotificationBanner";
import { ONBOARDING_COMPLETE_KEY } from "./components/onboarding/onboardingStorage";

// Code-split the heaviest views: each is only downloaded when the user
// actually navigates to that tab, instead of bloating the initial bundle.
// AuthPortal and OnboardingFlow are here too - a returning, already-signed-in
// user never touches either one again after their first session, so neither
// belongs in the main chunk every visitor has to download up front.
const PersonalWorkspace = lazy(() => import("./components/PersonalWorkspace"));
const InvoiceReceiptBuilder = lazy(() => import("./components/InvoiceReceiptBuilder"));
const NetWorthInvestments = lazy(() => import("./components/NetWorthInvestments"));
const FinancialReports = lazy(() => import("./components/FinancialReports"));
const AppGuide = lazy(() => import("./components/AppGuide"));
const AdMonetizationHub = lazy(() => import("./components/AdMonetizationHub"));
const AuthPortal = lazy(() => import("./components/AuthPortal"));
const OnboardingFlow = lazy(() => import("./components/onboarding/OnboardingFlow"));
// AZIIKI performance pass: these three were previously static top-level
// imports, meaning every visitor downloaded their JS up front even though
// only the Dashboard (BusinessDashboard, kept eager since it's the default
// tab) needs to be ready on first paint. CRM/AI Advisor are secondary tabs
// like Reports/Billing already lazy above, and InventoryManager is doubly
// worth deferring since it's hidden behind MVP_MODE right now - most launch
// users can never even reach it, so there's no reason to ship its JS eagerly.
const CustomerCRM = lazy(() => import("./components/CustomerCRM"));
const InventoryManager = lazy(() => import("./components/InventoryManager"));
const AIFieldAssistant = lazy(() => import("./components/AIFieldAssistant"));

// Supabase imports
import { supabase } from "./lib/supabaseClient";
import { api } from "./lib/api";
import { bulkImportState } from "./lib/bulkImport";
import { calculateInvoiceTotals, addMoney, subtractMoney } from "./lib/money";
import { getCurrencySymbol } from "./lib/currency";
import { detectBrowserCountryCode, detectBrowserTimezone, describeTimezoneOffsetDiff } from "./lib/location";
import { COUNTRIES } from "./lib/countries";
import { trackFeatureUsage } from "./lib/analytics";
import ThemeToggle from "./components/ThemeToggle";
import { useTheme } from "./lib/useTheme";
import ErrorBoundary from "./components/errors/ErrorBoundary";
import StatusScreen from "./components/errors/StatusScreen";
import { maintenanceStatus } from "./components/errors/statusPresets";

// ─────────────────────────────────────────────────────────────────────────
// AZIIKI BASIC VERSION 1.0 — MVP mode switch.
// Final launch reconciliation against the Brutal Product Teardown: when
// true, everything outside its "Smallest Lovable Version" list is hidden
// from navigation and UI, but NOT deleted — code, routes, and components
// all stay intact. That means: Wealth & Goals/investments, Updates &
// Growth/ad monetization, multi-business Partners/Shareholders ledger, the
// Personal Workspace toggle, AND Basic Inventory/Warehouse Stock (the
// Teardown places Inventory at v1.1, not launch). Flip this back to false
// (or delete the gating below) to fully restore the expanded product. See
// AZIIKI_BASIC_VERSION.docx and AZIIKI_BASIC_VERSION_1.0.docx for the
// earlier passes' rationale.
// ─────────────────────────────────────────────────────────────────────────
const MVP_MODE = true;

export default function App() {
  // AZIIKI DESIGN SYSTEM — dark/light mode QA fix: apply the saved/OS theme
  // at the true app root, not just when the sidebar's ThemeToggle happens to
  // mount. Previously the .dark class was only ever added once a signed-in
  // desktop user reached the dashboard, which meant the auth/sign-in screen
  // always rendered light (even with dark saved), and mobile users — where
  // the sidebar (and its ThemeToggle) is hidden — got no theme applied at
  // all. This call makes the theme active app-wide, immediately, regardless
  // of auth state or viewport; the sidebar toggle still works the same way.
  useTheme();

  // AZIIKI ERROR SYSTEM — maintenance mode. Checked once on mount via the
  // same public /api/config/features endpoint the Paystack/email feature
  // flags already use. A manual, operator-flipped switch (MAINTENANCE_MODE
  // env var), not an automated health check - see server/env.ts. null while
  // unknown (first paint) so nothing flashes before the check resolves;
  // false is assumed if the request itself fails, since blocking the whole
  // app because the feature-flag fetch hiccuped would be worse than the
  // maintenance screen it's meant to show.
  const [maintenanceInfo, setMaintenanceInfo] = useState<{ active: boolean; estimatedReturn: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.config
      .features()
      .then((flags) => {
        if (!cancelled) setMaintenanceInfo({ active: Boolean(flags.maintenanceMode), estimatedReturn: flags.maintenanceEstimatedReturn ?? null });
      })
      .catch(() => {
        if (!cancelled) setMaintenanceInfo({ active: false, estimatedReturn: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Authentication, Firestore Loading list and sync markers
  const [user, setUser] = useState<any>(null);
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    return localStorage.getItem("aziiki_is_guest") === "true";
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [needsPasswordRecovery, setNeedsPasswordRecovery] = useState<boolean>(false);
  // AZIIKI BASIC VERSION: surfaces a friendly message when a password-reset
  // or email-confirmation link is invalid/expired (Supabase redirects back
  // with #error=...&error_code=otp_expired instead of firing an auth event).
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    () => localStorage.getItem(ONBOARDING_COMPLETE_KEY) !== "true"
  );

  // Active Navigation Tab
  // Options: "dashboard" | "billing" | "crm" | "wealth" | "stock" | "monetize" | "ai"
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  const changeTab = (tab: string) => {
    // AZIIKI BASIC VERSION 1.0: block navigation to hidden-but-preserved tabs
    // (defends against stale deep links / persisted state, not just hidden buttons).
    // AZIIKI BASIC VERSION 1.0 — final launch reconciliation: "stock" (Basic
    // Inventory) is back in this blocklist. The Brutal Product Teardown places
    // Inventory at v1.1 (irrelevant for service businesses, adds a section
    // before the first invoice); a later brief had briefly restored it, but
    // the teardown's call is the one being shipped with. Re-enable by
    // removing "stock" from this list (and see the two nav/render sites
    // below) whenever Inventory's actual launch phase arrives.
    if (MVP_MODE && (tab === "wealth" || tab === "stock" || tab === "monetize")) {
      setActiveTab("dashboard");
      return;
    }
    setActiveTab(tab);
    if (tab === "reports") trackFeatureUsage("reportsGenerated");
    if (tab === "ai") trackFeatureUsage("aiQueries");
    if (tab === "guide") trackFeatureUsage("guideViews");
  };
  const [showMobileBanner, setShowMobileBanner] = useState<boolean>(true);
  const [dismissedTravelBannerFor, setDismissedTravelBannerFor] = useState<string | null>(null);

  // Business Profile Editing & Registration States
  const [showBrandConfig, setShowBrandConfig] = useState<boolean>(false);
  const [bizFormName, setBizFormName] = useState<string>("");
  const [bizFormIndustry, setBizFormIndustry] = useState<string>("");
  const [bizFormCurrency, setBizFormCurrency] = useState<string>("GHS");
  const [bizFormCountryCode, setBizFormCountryCode] = useState<string>("");
  const [bizFormTimezone, setBizFormTimezone] = useState<string>("");
  const [bizFormTaxRate, setBizFormTaxRate] = useState<number>(15);
  const [bizFormLogo, setBizFormLogo] = useState<string>("💼");
  const [bizFormDesc, setBizFormDesc] = useState<string>("");
  const [isAddingNewBiz, setIsAddingNewBiz] = useState<boolean>(false);
  const [isPersonalForm, setIsPersonalForm] = useState<boolean>(false);
  const [bizFormType, setBizFormType] = useState<"Sole Proprietor" | "Partnership" | "Company">("Sole Proprietor");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [allowFinancialApprovals, setAllowFinancialApprovals] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [bizFormLocked, setBizFormLocked] = useState<boolean>(false);

  // Sub-forms editing states
  const [newPartnerName, setNewPartnerName] = useState<string>("");
  const [newPartnerOwnership, setNewPartnerOwnership] = useState<number>(50);
  const [newPartnerCapital, setNewPartnerCapital] = useState<number>(10000);

  const [newShareholderName, setNewShareholderName] = useState<string>("");
  const [newShareholderShares, setNewShareholderShares] = useState<number>(1000);
  const [newShareholderCapital, setNewShareholderCapital] = useState<number>(25000);

  const [newRoleName, setNewRoleName] = useState<string>("");
  const [newRoleEmail, setNewRoleEmail] = useState<string>("");
  const [newRoleType, setNewRoleType] = useState<"Owner" | "Admin" | "Accountant" | "Staff">("Staff");

  // Multi-Business Switcher State
  const [businesses, setBusinesses] = useState<Business[]>([
    {
      id: "biz-1",
      name: "Kofi Media Services",
      industry: "Photography & Video Production",
      logo: "📸",
      primaryColor: "#D97706", // Amber
      taxRate: 15, // GHS VAT is typically 15%
      currency: "GHS",
      description: "Creative studio offering weddings, commercial product shoots, and corporate documentary photography based in East Legon, Accra.",
      businessType: "Sole Proprietor",
      partners: [],
      shareholders: [],
      roles: [],
      allowFinancialApprovals: false,
      auditLogs: []
    },
    {
      id: "biz-2",
      name: "Amina Fashion Couture",
      industry: "Boutique Apparel Design",
      logo: "🪡",
      primaryColor: "#EC4899", // Rose
      taxRate: 7.5, // NGN tax rate flat format
      currency: "NGN",
      description: "Custom design fashion line specializing in vibrant Ankara textiles, boutique bridal outfits, and local tailoring services out of Ikeja, Lagos.",
      businessType: "Partnership",
      partners: [
        { id: "p-1", name: "Amina Alao", ownershipPercentage: 60, capitalContribution: 300000, withdrawals: 12000 },
        { id: "p-2", name: "Tunde Coker", ownershipPercentage: 40, capitalContribution: 200000, withdrawals: 8000 }
      ],
      shareholders: [],
      roles: [],
      allowFinancialApprovals: false,
      auditLogs: []
    },
    {
      id: "biz-3",
      name: "Abidjan Expo Planners",
      industry: "Event Management & Logistics",
      logo: "🎪",
      primaryColor: "#10B981", // Emerald
      taxRate: 18, // VAT average
      currency: "KES",
      description: "Full-scale corporate exhibitions, stage designs, lighting rigs and luxury wedding coordination services across Nairobi and Mombasa.",
      businessType: "Company",
      partners: [],
      shareholders: [
        { id: "s-1", name: "Ama Mensah", sharesCount: 3500, equityValue: 350000, capitalContribution: 350000 },
        { id: "s-2", name: "Jean-Luc Kassi", sharesCount: 1500, equityValue: 150000, capitalContribution: 150000 }
      ],
      roles: [
        { id: "r-1", name: "Ama Mensah", email: "ama@abidjanexpo.com", role: "Owner" },
        { id: "r-2", name: "Jean-Luc Kassi", email: "jeanluc@abidjanexpo.com", role: "Accountant" },
        { id: "r-3", name: "Chloë Gbeho", email: "chloe@abidjanexpo.com", role: "Staff" }
      ],
      allowFinancialApprovals: true,
      auditLogs: [
        { id: "a-1", timestamp: "2026-06-18 09:12", userName: "Ama Mensah", action: "Enterprise Authorized", details: "Authorized standard capitalization of 5,000 common shares." },
        { id: "a-2", timestamp: "2026-06-20 14:45", userName: "Jean-Luc Kassi", action: "Ledger Reconciliation", details: "Reconciled treasury balance with wealth management partner assets." }
      ]
    }
  ]);
  
  const [currentBusinessId, setCurrentBusinessId] = useState<string>("biz-1");
  const currentBusiness = businesses.find(b => b.id === currentBusinessId) || businesses[0];

  // Traveling-user detection (Phase D of the currency/localization redesign):
  // if the business has a saved home timezone and it doesn't match the
  // browser's current one, the user is probably traveling - surface it as a
  // dismissible notice rather than silently assuming "home" applies.
  const browserTimezone = useMemo(() => detectBrowserTimezone(), []);
  const travelNotice = useMemo(() => {
    if (!currentBusiness?.timezone || currentBusiness.timezone === browserTimezone) return null;
    return describeTimezoneOffsetDiff(currentBusiness.timezone, browserTimezone);
  }, [currentBusiness?.timezone, browserTimezone]);

  // Global Ledger States populated with professional mock seed entries
  const [transactions, setTransactions] = useState<Transaction[]>([
    // Kofi Photo (GHS)
    { id: "tx-1", date: "2026-06-10", type: "income", category: "Client Project", amount: 4500, description: "Received 50% deposit for Osu Wedding photography shoot", paymentMethod: "Mobile Money", customerId: "cust-1", businessId: "biz-1" },
    { id: "tx-2", date: "2026-06-12", type: "expense", category: "Outsource Help", amount: 800, description: "Hired secondary backup camera shooter sub-lease", paymentMethod: "Cash", businessId: "biz-1" },
    { id: "tx-3", date: "2026-06-14", type: "expense", category: "Logistics", amount: 350, description: "Fuel card replenishment for Accra event site transit", paymentMethod: "Mobile Money", businessId: "biz-1" },
    { id: "tx-4", date: "2026-06-18", type: "income", category: "Consulting Fee", amount: 2200, description: "Corporate product placement campaign consulting retainer", paymentMethod: "Bank Transfer", customerId: "cust-2", businessId: "biz-1" },
    
    // Amina Fashion (NGN)
    { id: "tx-5", date: "2026-06-14", type: "income", category: "Direct Sales", amount: 650000, description: "Sold 3 pieces bespoke luxury bridal dress outfits", paymentMethod: "Bank Transfer", customerId: "cust-3", businessId: "biz-2" },
    { id: "tx-6", date: "2026-06-16", type: "expense", category: "Materials Purchase", amount: 180000, description: "Acquired wholesale premium Ankara wax cotton textiles", paymentMethod: "Bank Transfer", businessId: "biz-2" },
    { id: "tx-7", date: "2026-06-19", type: "expense", category: "Operations Cost", amount: 45000, description: "Studio generator fuel outlay for backup electricity", paymentMethod: "Cash", businessId: "biz-2" }
  ]);

  const [customers, setCustomers] = useState<Customer[]>([
    // Kofi Photo Clients
    { id: "cust-1", name: "Yaw Mensah", email: "yaw@mensah.com", phone: "+233 24 555 1010", notes: "Prefers payments strictly via Mobile Money. Ensure drafts are sent to WhatsApp.", category: "Freelance Client", businessId: "biz-1", avatarColor: "bg-indigo-500" },
    { id: "cust-2", name: "Naa Darko Corp", email: "naa@darkocorp.gh", phone: "+233 50 200 4400", notes: "Needs local withholding tax receipts attached to every single quotation.", category: "Corporate Sponsor", businessId: "biz-1", avatarColor: "bg-emerald-500" },
    
    // Amina Couture Clients
    { id: "cust-3", name: "Chioma Adeleke", email: "chioma@adeleke.ng", phone: "+234 812 555 9000", notes: "Consistently orders bespoke custom patterns. Requires high-contrast receipt validations.", category: "VIP Partner", businessId: "biz-2", avatarColor: "bg-rose-500" }
  ]);

  const [invoices, setInvoices] = useState<Invoice[]>([
    { 
      id: "inv-1", 
      invoiceNumber: "INV-2026101", 
      customerId: "cust-1", 
      date: "2026-06-15", 
      dueDate: "2026-06-29", 
      items: [{ description: "Wedding Product Shoot package including raw captures", quantity: 1, rate: 3000 }], 
      discount: 0, 
      taxRate: 15, 
      status: "Sent", 
      partialPaidAmount: 0, 
      businessId: "biz-1" 
    },
    { 
      id: "inv-2", 
      invoiceNumber: "INV-2026102", 
      customerId: "cust-2", 
      date: "2026-06-18", 
      dueDate: "2026-07-02", 
      items: [{ description: "Corporate visual consulting retainer tier-2 support", quantity: 1, rate: 2200 }], 
      discount: 5, 
      taxRate: 15, 
      status: "Paid", 
      partialPaidAmount: 0, 
      businessId: "biz-1" 
    },
    { 
      id: "inv-3", 
      invoiceNumber: "INV-2026201", 
      customerId: "cust-3", 
      date: "2026-06-12", 
      dueDate: "2026-06-26", 
      items: [{ description: "Custom hand-stiched Ankara apparel garments", quantity: 4, rate: 120000 }], 
      discount: 0, 
      taxRate: 7.5, 
      status: "Sent", 
      partialPaidAmount: 0, 
      businessId: "biz-2" 
    }
  ]);

  const [receipts, setReceipts] = useState<Receipt[]>([
    { id: "rec-1", receiptNumber: "REC-2026101", customerId: "cust-2", invoiceId: "inv-2", date: "2026-06-20", description: "Cleared retainer balance for corporate photography campaign", amountPaid: 2200, paymentMethod: "Bank Transfer", businessId: "biz-1" }
  ]);

  const [quotations, setQuotations] = useState<Quotation[]>([
    { 
      id: "quote-1", 
      quoteNumber: "EST-2026101", 
      customerId: "cust-1", 
      date: "2026-06-14", 
      validUntil: "2026-06-28", 
      items: [{ description: "Studio lighting lease & post-production layout presets", quantity: 1, rate: 1500 }], 
      discount: 2, 
      totalAmount: 1470, 
      status: "Sent", 
      businessId: "biz-1" 
    }
  ]);

  // Sovereign high-yield local asset placements (updated to tracker model with amountInvested)
  const [investments, setInvestments] = useState<Investment[]>([
    { id: "inv-s1", type: "Treasury Bill", name: "91-Day Sovereign Treasury Bill", institution: "GCB Banc Accra", value: 5000, amountInvested: 5000, expectedReturnRate: 19.8, dateAcquired: "2026-05-10", maturityDate: "2026-08-10", notes: "Low-risk reserve backing." },
    { id: "inv-s2", type: "Mutual Fund", name: "High-Growth Equity Tracker Fund", institution: "Regional Wealth Management", value: 3950, amountInvested: 3500, expectedReturnRate: 15.5, dateAcquired: "2026-04-12", notes: "Equity allocation for inflation hedging." }
  ]);

  // Owned Asset Register and Planning state
  const [assets, setAssets] = useState<Asset[]>([
    { id: "asset-1", name: "Pro Studio Flash Lighting Rig", category: "Equipment", purchaseDate: "2025-08-20", purchasePrice: 2200, currentValue: 1850, depreciationMethod: "Straight Line", usefulLifeYears: 5, salvageValue: 400, maintenanceLastDate: "2026-06-01", maintenanceNextDate: "2026-09-01", maintenanceStatus: "Good", maintenanceNotes: "Checked capacitor balance. OK.", documentsNotes: "1-year warranty card with Photostore Ghana.", notes: "Primary lighting asset for portrait sessions.", businessId: "biz-1" },
    { id: "asset-2", name: "High-Speed Commercial Sewing Machine", category: "Machinery", purchaseDate: "2025-03-15", purchasePrice: 1200, currentValue: 950, depreciationMethod: "Straight Line", usefulLifeYears: 8, salvageValue: 200, maintenanceLastDate: "2026-05-10", maintenanceNextDate: "2026-11-10", maintenanceStatus: "Good", maintenanceNotes: "Belt adjusted, oil reservoir topped up.", documentsNotes: "Receipt and serial plate photo kept in Accra office.", notes: "Heavy duty workhorse for denim and canvas fabric.", businessId: "biz-2" }
  ]);

  // Business expansions goals
  const [goals, setGoals] = useState<Goal[]>([
    { id: "goal-1", type: "Equipment", name: "Procure Canon RF 28-70mm Glass Upgrade", currentAmount: 1800, targetAmount: 4200, deadline: "2026-09-30", businessId: "biz-1" },
    { id: "goal-2", type: "Expansion", name: "Settle Abuja fashion design branch lease", currentAmount: 380000, targetAmount: 1200000, deadline: "2026-11-30", businessId: "biz-2" }
  ]);

  // Liabilities registry
  const [debts, setDebts] = useState<Debt[]>([
    { id: "debt-1", creditor: "MacBook Pro Camera Store Accra", amount: 1500, interestRate: 0, dueDate: "2026-08-15", type: "Supplier Credit" }
  ]);

  // Warehouse inventory counts
  const [inventory, setInventory] = useState<InventoryItem[]>([
    // Kofi Photo items
    { id: "item-1", name: "SanDisk Extreme Pro 128GB SD Card", sku: "SKU-SD128", quantity: 14, minStockAlert: 5, unitCost: 120, unitPrice: 200, supplierName: "Accra Digital Wholesale", supplierContact: "+233 24 555 1010", businessId: "biz-1" },
    { id: "item-2", name: "AA NiMH Flash batteries pack x12", sku: "SKU-BATT", quantity: 4, minStockAlert: 6, unitCost: 45, unitPrice: 85, supplierName: "Kumasi Energy Port", supplierContact: "+233 50  300 1100", businessId: "biz-1" },
    
    // Amina Fashion items
    { id: "item-3", name: "Organic Cotton Ankara Wax Textiles rolls", sku: "SKU-ANK", quantity: 22, minStockAlert: 10, unitCost: 8000, unitPrice: 15000, supplierName: "Alaba Textile Wharf", supplierContact: "+234 812 400 90", businessId: "biz-2" }
  ]);

  // 1. Listen to Supabase Auth changes and fetch this user's dashboard state
  // via the relational API (src/lib/api.ts) instead of a single Firestore
  // document blob.
  useEffect(() => {
    // AZIIKI BASIC VERSION: a reset/verification link that's expired or was
    // already used sends the user back here with an error in the URL hash
    // rather than a session — surface that instead of a silent, confusing
    // plain login screen.
    if (window.location.hash.includes("error=")) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const errorCode = hashParams.get("error_code");
      const errorDescription = hashParams.get("error_description");
      if (errorCode === "otp_expired") {
        setAuthLinkError("That link has expired. Request a new one below.");
      } else if (hashParams.get("error")) {
        setAuthLinkError(
          errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, " ")) : "That link is no longer valid. Request a new one below."
        );
      }
      // Clean the error params out of the URL so a refresh doesn't re-show them.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setNeedsPasswordRecovery(true);
        setIsAuthLoading(false);
        return;
      }
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setUser(data.session.user);
      } else {
        setIsAuthLoading(false);
      }
    })();

    return () => authListener.subscription.unsubscribe();
  }, []);

  // 1a. Whenever `user` becomes set (fresh login, page reload with an
  // existing session, or token refresh), load this account's data.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setIsGuest(false);
      localStorage.setItem("aziiki_is_guest", "false");
      setIsAuthLoading(true);
      try {
        const remoteData = await api.sync.fetchAll();
        if (cancelled) return;
        if (remoteData && remoteData.businesses && remoteData.businesses.length > 0) {
          setBusinesses(remoteData.businesses || []);
          setTransactions(remoteData.transactions || []);
          setCustomers(remoteData.customers || []);
          setInvoices(remoteData.invoices || []);
          setReceipts(remoteData.receipts || []);
          setQuotations(remoteData.quotations || []);
          setInvestments(remoteData.investments || []);
          setAssets(remoteData.assets || []);
          setGoals(remoteData.goals || []);
          setDebts(remoteData.debts || []);
          setInventory(remoteData.inventory || []);
          setCurrentBusinessId(remoteData.businesses[0].id);
        } else {
          // No remote data exists yet for this account - create one real,
          // persisted business row rather than a local-only placeholder.
          const created = await api.businesses.create({
            name: "My Enterprise",
            industry: "Retail & Logistics",
            logo: "💼",
            primaryColor: "#2563eb",
            taxRate: 15,
            currency: "USD",
            description: "Clean cloud-connected ledger workspace.",
            businessType: "Sole Proprietor",
          });
          if (cancelled) return;
          setBusinesses([{ ...created, partners: [], shareholders: [], roles: [], auditLogs: [] }]);
          setCurrentBusinessId(created.id);
          setTransactions([]);
          setCustomers([]);
          setInvoices([]);
          setReceipts([]);
          setQuotations([]);
          setInvestments([]);
          setAssets([]);
          setGoals([]);
          setDebts([]);
          setInventory([]);
        }
      } catch (e) {
        console.error("Failed to fetch this account's dashboard data:", e);
      } finally {
        if (!cancelled) setIsAuthLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // 1b. Load guest data from localStorage when in guest mode
  useEffect(() => {
    localStorage.setItem("aziiki_is_guest", isGuest ? "true" : "false");
    if (isGuest && !user) {
      const savedData = localStorage.getItem("aziiki_guest_data");
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.businesses && parsed.businesses.length > 0) {
            setBusinesses(parsed.businesses);
            if (parsed.transactions) setTransactions(parsed.transactions);
            if (parsed.customers) setCustomers(parsed.customers);
            if (parsed.invoices) setInvoices(parsed.invoices);
            if (parsed.receipts) setReceipts(parsed.receipts);
            if (parsed.quotations) setQuotations(parsed.quotations);
            if (parsed.investments) setInvestments(parsed.investments);
            if (parsed.assets) setAssets(parsed.assets);
            if (parsed.goals) setGoals(parsed.goals);
            if (parsed.debts) setDebts(parsed.debts);
            if (parsed.inventory) setInventory(parsed.inventory);
            setCurrentBusinessId(parsed.businesses[0].id);
          }
        } catch (e) {
          console.error("Failed to restore guest data from localStorage:", e);
        }
      }
    }
  }, [isGuest, user]);

  // 2. Guest sessions (no Supabase account) persist to localStorage only.
  // Signed-in sessions no longer round-trip the entire dashboard state as one
  // blob on every change - each mutation handler below (handleAddTransaction,
  // handleAddInvoice, etc.) persists just that one record via the relational
  // API as it happens, which is what makes per-table RLS meaningful.
  useEffect(() => {
    if (isAuthLoading || !isGuest) return;

    const delayDebounceLocal = setTimeout(() => {
      const guestPayload = {
        businesses,
        transactions,
        customers,
        invoices,
        receipts,
        quotations,
        investments,
        assets,
        goals,
        debts,
        inventory
      };
      localStorage.setItem("aziiki_guest_data", JSON.stringify(guestPayload));
    }, 1000);
    return () => clearTimeout(delayDebounceLocal);
  }, [isGuest, isAuthLoading, businesses, transactions, customers, invoices, receipts, quotations, investments, assets, goals, debts, inventory]);

  // Keep brand configuration editing form in sync with active business properties
  useEffect(() => {
    if (currentBusiness && !isAddingNewBiz) {
      setBizFormName(currentBusiness.name);
      setBizFormIndustry(currentBusiness.industry);
      setBizFormCurrency(currentBusiness.currency);
      setBizFormCountryCode(currentBusiness.countryCode || detectBrowserCountryCode() || "");
      setBizFormTimezone(currentBusiness.timezone || detectBrowserTimezone());
      setBizFormTaxRate(currentBusiness.taxRate);
      setBizFormLogo(currentBusiness.logo || "💼");
      setBizFormDesc(currentBusiness.description || "");
      setBizFormType(currentBusiness.businessType || "Sole Proprietor");
      setPartners(currentBusiness.partners || []);
      setShareholders(currentBusiness.shareholders || []);
      setRoles(currentBusiness.roles || []);
      setAllowFinancialApprovals(currentBusiness.allowFinancialApprovals || false);
      setAuditLogs(currentBusiness.auditLogs || []);
      setBizFormLocked(currentBusiness.locked || false);
    } else if (isAddingNewBiz) {
      setBizFormName("");
      setBizFormIndustry("");
      setBizFormCurrency("GHS");
      setBizFormCountryCode(detectBrowserCountryCode() || "");
      setBizFormTimezone(detectBrowserTimezone());
      setBizFormTaxRate(15);
      setBizFormLogo("💼");
      setBizFormDesc("");
      setBizFormType("Sole Proprietor");
      setPartners([]);
      setShareholders([]);
      setRoles([]);
      setAllowFinancialApprovals(false);
      setAuditLogs([]);
      setBizFormLocked(false);
    }
  }, [currentBusinessId, isAddingNewBiz]);

  // 3. Clear sessions and sign out safely
  const handleLogout = async () => {
    setIsAuthLoading(true);
    try {
      await api.auth.logout().catch(() => {});
      await supabase.auth.signOut();
      setUser(null);
      setIsGuest(false);
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAuthSuccess = async (authInfo: {
    user: any;
    isNewUser: boolean;
    businessName?: string;
    currency?: string;
    seedDemoData?: boolean;
  }) => {
    setUser(authInfo.user);
    setIsGuest(false);
    localStorage.setItem("aziiki_is_guest", "false");
    
    if (authInfo.isNewUser) {
      const primaryColor = "#2563eb"; // Standard blue
      const newBiz: Business = {
        id: "biz-init-" + Math.random().toString(36).substr(2, 5),
        name: authInfo.businessName || "My Trade Enterprise",
        industry: "Retail & General Logistics",
        logo: "💼",
        primaryColor: primaryColor,
        taxRate: 15,
        currency: authInfo.currency || "GHS",
        description: "Registered standard SME business ledger synced to unifed cloud nodes successfully.",
        businessType: "Sole Proprietor",
        partners: [],
        shareholders: [],
        roles: [],
        allowFinancialApprovals: false,
        auditLogs: []
      };

      let baseBusinesses = [newBiz];
      let baseTransactions: Transaction[] = [];
      let baseCustomers: Customer[] = [];
      let baseInvoices: Invoice[] = [];
      let baseReceipts: Receipt[] = [];
      let baseQuotations: Quotation[] = [];
      let baseInvestments: Investment[] = [];
      let baseAssets: Asset[] = [];
      let baseGoals: Goal[] = [];
      let baseDebts: Debt[] = [];
      let baseInventory: InventoryItem[] = [];

      // Check if there is guest data in localStorage to migrate
      const localGuestDataStr = localStorage.getItem("aziiki_guest_data");
      let hasMigratedGuestData = false;
      if (localGuestDataStr) {
        try {
          const parsed = JSON.parse(localGuestDataStr);
          if (parsed.businesses && parsed.businesses.length > 0) {
            baseBusinesses = parsed.businesses;
            baseTransactions = parsed.transactions || [];
            baseCustomers = parsed.customers || [];
            baseInvoices = parsed.invoices || [];
            baseReceipts = parsed.receipts || [];
            baseQuotations = parsed.quotations || [];
            baseInvestments = parsed.investments || [];
            baseAssets = parsed.assets || [];
            baseGoals = parsed.goals || [];
            baseDebts = parsed.debts || [];
            baseInventory = parsed.inventory || [];
            hasMigratedGuestData = true;
          }
        } catch (e) {
          console.error("Failed to parse guest data for cloud migration:", e);
        }
      }

      if (!hasMigratedGuestData && authInfo.seedDemoData) {
        // Carry over high-quality African operational presets
        baseBusinesses.push({
          id: "biz-nested-1",
          name: "Amina Fashion Couture",
          industry: "Boutique Apparel Design",
          logo: "🪡",
          primaryColor: "#EC4899",
          taxRate: 7.5,
          currency: "NGN",
          description: "Ankara textiles design brand based in Ikeja, Lagos.",
          businessType: "Partnership",
          partners: [
            { id: "p-1", name: "Amina Alao", ownershipPercentage: 60, capitalContribution: 300000, withdrawals: 12000 },
            { id: "p-2", name: "Tunde Coker", ownershipPercentage: 40, capitalContribution: 200000, withdrawals: 8000 }
          ],
          shareholders: [],
          roles: [],
          allowFinancialApprovals: false,
          auditLogs: []
        });

        baseTransactions = [
          { id: "tx-1", date: "2026-06-10", type: "income", category: "Client Project", amount: 4500, description: "Received 50% deposit for photography package", paymentMethod: "Mobile Money", customerId: "cust-1", businessId: newBiz.id },
          { id: "tx-2", date: "2026-06-12", type: "expense", category: "Outsource Help", amount: 800, description: "Hired secondary layout design contractors", paymentMethod: "Cash", businessId: newBiz.id },
          { id: "tx-5", date: "2026-06-14", type: "income", category: "Direct Sales", amount: 650000, description: "Sold 3 pieces bespoke luxury dress outfits", paymentMethod: "Bank Transfer", customerId: "cust-3", businessId: "biz-nested-1" }
        ];

        baseCustomers = [
          { id: "cust-1", name: "Yaw Mensah", email: "yaw@mensah.com", phone: "+233 24 555 1010", notes: "Prefers payments route via Mobile Money.", category: "Freelance", businessId: newBiz.id, avatarColor: "bg-indigo-500" },
          { id: "cust-3", name: "Chioma Adeleke", email: "chioma@adeleke.ng", phone: "+234 812 555 9000", notes: "Consistently orders bespoke custom patterns.", category: "VIP Partner", businessId: "biz-nested-1", avatarColor: "bg-rose-500" }
        ];

        baseInvoices = [
          { id: "inv-1", invoiceNumber: "INV-2026101", customerId: "cust-1", date: "2026-06-15", dueDate: "2026-06-29", items: [{ description: "Wedding Product package", quantity: 1, rate: 3000 }], discount: 0, taxRate: 15, status: "Sent", partialPaidAmount: 0, businessId: newBiz.id }
        ];

        baseGoals = [
          { id: "goal-1", type: "Equipment", name: "Procure Lens Upgrade", currentAmount: 1800, targetAmount: 4200, deadline: "2026-09-30", businessId: newBiz.id }
        ];

        baseAssets = [
          { id: "asset-seed-1", name: "Pro Studio Flash Lighting Rig", category: "Equipment", purchaseDate: "2025-08-20", purchasePrice: 2200, currentValue: 1850, depreciationMethod: "Straight Line", usefulLifeYears: 5, salvageValue: 400, maintenanceLastDate: "2026-06-01", maintenanceNextDate: "2026-09-01", maintenanceStatus: "Good", maintenanceNotes: "Checked capacitor balance. OK.", documentsNotes: "1-year warranty card with Photostore Ghana.", notes: "Primary lighting asset for portrait sessions.", businessId: newBiz.id }
        ];

        baseInventory = [
          { id: "item-1", name: "SanDisk Extreme Pro 128GB SD Card", sku: "SKU-SD128", quantity: 14, minStockAlert: 5, unitCost: 120, unitPrice: 200, supplierName: "Accra Digital Wholesale", supplierContact: "+233 24 555 1010", businessId: newBiz.id }
        ];
      }

      // Persist the seed/migrated data as real relational rows (each with its
      // own server-issued UUID and business_id foreign key) before it ever
      // touches component state, rather than writing one document blob.
      setIsAuthLoading(true);
      try {
        const persisted = await bulkImportState({
          businesses: baseBusinesses,
          transactions: baseTransactions,
          customers: baseCustomers,
          invoices: baseInvoices,
          receipts: baseReceipts,
          quotations: baseQuotations,
          investments: baseInvestments,
          assets: baseAssets,
          goals: baseGoals,
          debts: baseDebts,
          inventory: baseInventory,
        });

        setBusinesses(persisted.businesses);
        setCurrentBusinessId(persisted.businesses[0].id);
        setTransactions(persisted.transactions);
        setCustomers(persisted.customers);
        setInvoices(persisted.invoices);
        setReceipts(persisted.receipts);
        setQuotations(persisted.quotations);
        setInvestments(persisted.investments);
        setAssets(persisted.assets);
        setGoals(persisted.goals);
        setDebts(persisted.debts);
        setInventory(persisted.inventory);

        // Clear local guest data on successful cloud merge
        localStorage.removeItem("aziiki_guest_data");
      } catch (err) {
        console.error("Failed to initialize this account's workspace:", err);
      } finally {
        setIsAuthLoading(false);
      }
    }
  };

  // Global modifiers handlers passed down to modular interfaces
  // Resolves the "custom-<name>" convention InvoiceReceiptBuilder uses for
  // one-off clients that aren't in the CRM into the {customerId,
  // customClientName} shape the relational schema expects.
  const splitCustomerRef = (customerId?: string): { customerId?: string; customClientName?: string } => {
    if (!customerId) return {};
    if (customerId.startsWith("custom-")) return { customClientName: customerId.slice(7) };
    return { customerId };
  };

  const handleAddTransaction = async (newTx: Transaction) => {
    if (isGuest) {
      setTransactions([newTx, ...transactions]);
      return;
    }
    try {
      const created = await api.transactions.create({
        businessId: newTx.businessId,
        date: newTx.date,
        type: newTx.type,
        category: newTx.category,
        amount: newTx.amount,
        description: newTx.description,
        paymentMethod: newTx.paymentMethod,
        customerId: newTx.customerId,
        proofUri: newTx.proofUri,
        currency: newTx.currency,
        exchangeRateToBusinessCurrency: newTx.exchangeRateToBusinessCurrency,
      });
      setTransactions(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save transaction:", err);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    if (!isGuest) {
      try { await api.transactions.remove(id); } catch (err) { console.error("Failed to delete transaction:", err); }
    }
  };

  const handleAddCustomer = async (newCust: Customer) => {
    if (isGuest) {
      setCustomers([newCust, ...customers]);
      return;
    }
    try {
      const created = await api.customers.create({
        businessId: newCust.businessId,
        name: newCust.name,
        email: newCust.email,
        phone: newCust.phone,
        notes: newCust.notes,
        category: newCust.category,
        avatarColor: newCust.avatarColor,
        preferredCurrency: newCust.preferredCurrency,
      });
      setCustomers(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save customer:", err);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    setCustomers(customers.filter(c => c.id !== id));
    if (!isGuest) {
      try { await api.customers.remove(id); } catch (err) { console.error("Failed to delete customer:", err); }
    }
  };

  // Local, optimistic mirror of what the server's invoices route does
  // server-side (see src/server/routes/invoices.ts runPaidWorkflow) when an
  // invoice is marked Paid: log a matching income transaction and decrement
  // matching warehouse stock. In guest mode this local copy IS the source of
  // truth; when signed in, the server independently persists the same
  // derived records (using the identical calculateInvoiceTotals math), so
  // this function never itself calls the API - that would double them up.
  const triggerInvoicePaidWorkflow = (paidInv: Invoice) => {
    const totals = calculateInvoiceTotals(paidInv.items, paidInv.discount, paidInv.taxRate);

    const newTx: Transaction = {
      id: "tx-inv-auto-paid-" + Math.random().toString(36).substr(2, 9),
      date: paidInv.date || new Date().toISOString().split("T")[0],
      type: "income",
      category: "Sales",
      amount: totals.total,
      description: `Automated Inflow: Settled Invoice ${paidInv.invoiceNumber}`,
      paymentMethod: "Mobile Money",
      customerId: paidInv.customerId,
      businessId: paidInv.businessId
    };

    setTransactions(prev => [newTx, ...prev]);

    // Subtracts the invoiced quantities from Warehouse Stock matching the item name
    setInventory(prevInv => {
      return prevInv.map(stockItem => {
        if (stockItem.businessId !== paidInv.businessId) return stockItem;

        // Find matching item by name (using substring / case-insensitive search)
        const matchedItem = paidInv.items.find(invItem =>
          invItem.description.toLowerCase().trim() === stockItem.name.toLowerCase().trim() ||
          stockItem.name.toLowerCase().trim().includes(invItem.description.toLowerCase().trim()) ||
          invItem.description.toLowerCase().trim().includes(stockItem.name.toLowerCase().trim())
        );

        if (matchedItem) {
          const updatedQty = Math.max(0, stockItem.quantity - matchedItem.quantity);
          return { ...stockItem, quantity: updatedQty };
        }
        return stockItem;
      });
    });
  };

  const handleAddInvoice = async (newInv: Invoice) => {
    if (isGuest) {
      setInvoices([newInv, ...invoices]);
      if (newInv.status === "Paid") triggerInvoicePaidWorkflow(newInv);
      return;
    }
    try {
      const { customerId, customClientName } = splitCustomerRef(newInv.customerId);
      const created = await api.invoices.create({
        businessId: newInv.businessId,
        customerId,
        customClientName,
        invoiceNumber: newInv.invoiceNumber,
        date: newInv.date,
        dueDate: newInv.dueDate,
        items: newInv.items,
        discount: newInv.discount,
        taxRate: newInv.taxRate,
        status: newInv.status,
        partialPaidAmount: newInv.partialPaidAmount,
        currency: newInv.currency,
        exchangeRateToBusinessCurrency: newInv.exchangeRateToBusinessCurrency,
      });
      setInvoices(prev => [created, ...prev]);
      if (created.status === "Paid") triggerInvoicePaidWorkflow(created);
    } catch (err) {
      console.error("Failed to save invoice:", err);
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, nextStatus: string) => {
    const target = invoices.find(inv => inv.id === invoiceId);
    const shouldTriggerPaidWorkflow = Boolean(target && nextStatus === "Paid" && target.status !== "Paid");

    setInvoices(prev => prev.map(inv => (inv.id === invoiceId ? { ...inv, status: nextStatus as Invoice["status"] } : inv)));
    if (target && shouldTriggerPaidWorkflow) {
      triggerInvoicePaidWorkflow({ ...target, status: nextStatus as Invoice["status"] });
    }

    if (!isGuest) {
      try {
        await api.invoices.update(invoiceId, { status: nextStatus });
      } catch (err) {
        console.error("Failed to update invoice status:", err);
      }
    }
  };

  const handleAddReceipt = async (newRec: Receipt) => {
    if (isGuest) {
      setReceipts([newRec, ...receipts]);
      const resolvedTx: Transaction = {
        id: "tx-auto-" + Math.random().toString(36).substr(2, 9),
        date: newRec.date,
        type: "income",
        category: "Client Project",
        amount: newRec.amountPaid,
        description: newRec.description,
        paymentMethod: newRec.paymentMethod,
        customerId: newRec.customerId,
        businessId: currentBusiness.id
      };
      setTransactions(prev => [resolvedTx, ...prev]);
      return;
    }
    try {
      const { customerId, customClientName } = splitCustomerRef(newRec.customerId);
      const created = await api.receipts.create({
        businessId: newRec.businessId,
        customerId,
        customClientName,
        invoiceId: newRec.invoiceId,
        receiptNumber: newRec.receiptNumber,
        date: newRec.date,
        description: newRec.description,
        amountPaid: newRec.amountPaid,
        paymentMethod: newRec.paymentMethod,
        currency: newRec.currency,
        exchangeRateToBusinessCurrency: newRec.exchangeRateToBusinessCurrency,
      });
      setReceipts(prev => [created, ...prev]);
      // The server already logs the companion income transaction as part of
      // creating the receipt - refresh transactions from it so local state
      // picks up that server-generated row instead of inventing our own.
      const allTransactions = await api.transactions.list();
      setTransactions(allTransactions);
    } catch (err) {
      console.error("Failed to save receipt:", err);
    }
  };

  const handleAddQuotation = async (newQuote: Quotation) => {
    if (isGuest) {
      setQuotations([newQuote, ...quotations]);
      return;
    }
    try {
      const { customerId, customClientName } = splitCustomerRef(newQuote.customerId);
      const created = await api.quotations.create({
        businessId: newQuote.businessId,
        customerId,
        customClientName,
        quoteNumber: newQuote.quoteNumber,
        date: newQuote.date,
        validUntil: newQuote.validUntil,
        items: newQuote.items,
        discount: newQuote.discount,
        status: newQuote.status,
        currency: newQuote.currency,
        exchangeRateToBusinessCurrency: newQuote.exchangeRateToBusinessCurrency,
      });
      setQuotations(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save quotation:", err);
    }
  };

  const handleConvertQuoteToInvoice = async (quoteId: string) => {
    const quote = quotations.find(q => q.id === quoteId);
    if (!quote) return;

    const newInvNum = `INV-${2026}${invoices.length + 101}`;
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    if (isGuest) {
      const newInv: Invoice = {
        id: "inv-conv-" + Math.random().toString(36).substr(2, 9),
        invoiceNumber: newInvNum,
        customerId: quote.customerId,
        date: new Date().toISOString().split("T")[0],
        dueDate,
        items: quote.items,
        discount: quote.discount,
        taxRate: currentBusiness.taxRate,
        status: "Draft",
        partialPaidAmount: 0,
        businessId: currentBusiness.id
      };
      setInvoices([newInv, ...invoices]);
      setQuotations(quotations.map(q => q.id === quoteId ? { ...q, status: "Converted" } : q));
      return;
    }

    try {
      const invoice = await api.quotations.convertToInvoice(quoteId, {
        invoiceNumber: newInvNum,
        dueDate,
        taxRate: currentBusiness.taxRate,
      });
      setInvoices(prev => [invoice, ...prev]);
      setQuotations(prev => prev.map(q => (q.id === quoteId ? { ...q, status: "Converted" } : q)));
    } catch (err) {
      console.error("Failed to convert quotation to invoice:", err);
    }
  };

  const handleAddInvestment = async (newInv: Investment) => {
    if (isGuest) {
      setInvestments([newInv, ...investments]);
      return;
    }
    try {
      const created = await api.investments.create({
        businessId: newInv.businessId,
        type: newInv.type,
        name: newInv.name,
        institution: newInv.institution,
        value: newInv.value,
        amountInvested: newInv.amountInvested,
        maturityDate: newInv.maturityDate,
        expectedReturnRate: newInv.expectedReturnRate,
        dateAcquired: newInv.dateAcquired,
        notes: newInv.notes,
      });
      setInvestments(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save investment:", err);
    }
  };

  const handleAddGoal = async (newGoal: Goal) => {
    if (isGuest) {
      setGoals([newGoal, ...goals]);
      return;
    }
    try {
      const created = await api.goals.create({
        businessId: newGoal.businessId,
        type: newGoal.type,
        name: newGoal.name,
        currentAmount: newGoal.currentAmount,
        targetAmount: newGoal.targetAmount,
        deadline: newGoal.deadline,
        currency: newGoal.currency,
      });
      setGoals(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save goal:", err);
    }
  };

  const handleContributeToGoal = async (goalId: string, amount: number, currency?: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    if (isGuest) {
      // Guest mode has no exchange-rate infrastructure to convert against,
      // so a contribution currency other than the goal's own just adds the
      // raw amount - the same "no rate yet" fallback the real backend uses.
      const newTx: Transaction = {
        id: "tx-contribution-" + Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split("T")[0],
        type: "expense",
        category: "Operations Cost",
        amount: amount,
        description: `Savings goal contribution: ${goal.name}`,
        paymentMethod: "Cash",
        businessId: currentBusiness.id,
        currency: currency ?? goal.currency,
      };
      setTransactions([newTx, ...transactions]);
      setGoals(goals.map(g => (g.id === goalId ? { ...g, currentAmount: addMoney(g.currentAmount, amount) } : g)));
      return;
    }

    try {
      const updatedGoal = await api.goals.contribute(goalId, amount, currency);
      setGoals(prev => prev.map(g => (g.id === goalId ? updatedGoal : g)));
      const allTransactions = await api.transactions.list();
      setTransactions(allTransactions);
    } catch (err) {
      console.error("Failed to contribute to goal:", err);
    }
  };

  const handleRestoreBackup = (backup: {
    transactions?: Transaction[];
    customers?: Customer[];
    invoices?: Invoice[];
    goals?: Goal[];
    investments?: Investment[];
    debts?: Debt[];
    inventory?: InventoryItem[];
  }) => {
    if (backup.transactions) setTransactions(backup.transactions);
    if (backup.customers) setCustomers(backup.customers);
    if (backup.invoices) setInvoices(backup.invoices);
    if (backup.goals) setGoals(backup.goals);
    if (backup.investments) setInvestments(backup.investments);
    if (backup.debts) setDebts(backup.debts);
    if (backup.inventory) setInventory(backup.inventory);
  };

  const handleAddDebt = async (newDebt: Debt) => {
    if (isGuest) {
      setDebts([newDebt, ...debts]);
      return;
    }
    try {
      const created = await api.debts.create({
        businessId: newDebt.businessId,
        creditor: newDebt.creditor,
        amount: newDebt.amount,
        interestRate: newDebt.interestRate,
        dueDate: newDebt.dueDate,
        type: newDebt.type,
        currency: newDebt.currency,
      });
      setDebts(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save debt:", err);
    }
  };

  const handleAddInventoryItem = async (newItem: InventoryItem) => {
    if (isGuest) {
      setInventory([newItem, ...inventory]);
      return;
    }
    try {
      const created = await api.inventory.create({
        businessId: newItem.businessId,
        name: newItem.name,
        sku: newItem.sku,
        quantity: newItem.quantity,
        minStockAlert: newItem.minStockAlert,
        unitCost: newItem.unitCost,
        unitPrice: newItem.unitPrice,
        supplierName: newItem.supplierName,
        supplierContact: newItem.supplierContact,
      });
      setInventory(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save inventory item:", err);
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    setInventory(inventory.filter(i => i.id !== id));
    if (!isGuest) {
      try { await api.inventory.remove(id); } catch (err) { console.error("Failed to delete inventory item:", err); }
    }
  };

  const handleDeleteDebt = async (id: string) => {
    setDebts(debts.filter(d => d.id !== id));
    if (!isGuest) {
      try { await api.debts.remove(id); } catch (err) { console.error("Failed to delete debt:", err); }
    }
  };

  const handleDeleteGoal = async (id: string) => {
    setGoals(goals.filter(g => g.id !== id));
    if (!isGuest) {
      try { await api.goals.remove(id); } catch (err) { console.error("Failed to delete goal:", err); }
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    setInvestments(investments.filter(i => i.id !== id));
    if (!isGuest) {
      try { await api.investments.remove(id); } catch (err) { console.error("Failed to delete investment:", err); }
    }
  };

  const handleAddAsset = async (newAsset: Asset) => {
    if (isGuest) {
      setAssets([newAsset, ...assets]);
      return;
    }
    try {
      const created = await api.assets.create({
        businessId: newAsset.businessId,
        name: newAsset.name,
        category: newAsset.category,
        purchaseDate: newAsset.purchaseDate,
        purchasePrice: newAsset.purchasePrice,
        currentValue: newAsset.currentValue,
        depreciationMethod: newAsset.depreciationMethod,
        usefulLifeYears: newAsset.usefulLifeYears,
        salvageValue: newAsset.salvageValue,
        maintenanceLastDate: newAsset.maintenanceLastDate,
        maintenanceNextDate: newAsset.maintenanceNextDate,
        maintenanceStatus: newAsset.maintenanceStatus,
        maintenanceNotes: newAsset.maintenanceNotes,
        documentsNotes: newAsset.documentsNotes,
        notes: newAsset.notes,
      });
      setAssets(prev => [created, ...prev]);
    } catch (err) {
      console.error("Failed to save asset:", err);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    setAssets(assets.filter(a => a.id !== id));
    if (!isGuest) {
      try { await api.assets.remove(id); } catch (err) { console.error("Failed to delete asset:", err); }
    }
  };

  const handleUpdateAsset = async (updatedAsset: Asset) => {
    setAssets(assets.map(a => a.id === updatedAsset.id ? updatedAsset : a));
    if (!isGuest) {
      try {
        await api.assets.update(updatedAsset.id, {
          name: updatedAsset.name,
          category: updatedAsset.category,
          purchaseDate: updatedAsset.purchaseDate,
          purchasePrice: updatedAsset.purchasePrice,
          currentValue: updatedAsset.currentValue,
          depreciationMethod: updatedAsset.depreciationMethod,
          usefulLifeYears: updatedAsset.usefulLifeYears,
          salvageValue: updatedAsset.salvageValue,
          maintenanceLastDate: updatedAsset.maintenanceLastDate,
          maintenanceNextDate: updatedAsset.maintenanceNextDate,
          maintenanceStatus: updatedAsset.maintenanceStatus,
          maintenanceNotes: updatedAsset.maintenanceNotes,
          documentsNotes: updatedAsset.documentsNotes,
          notes: updatedAsset.notes,
        });
      } catch (err) {
        console.error("Failed to update asset:", err);
      }
    }
  };

  const handleRepayDebt = async (debtId: string, amount: number, paymentMethodName: string) => {
    if (isGuest) {
      setDebts(debts.map(d => {
        if (d.id === debtId) {
          return { ...d, amount: Math.max(0, subtractMoney(d.amount, amount)) };
        }
        return d;
      }).filter(d => d.amount > 0));
      return;
    }
    try {
      const result = await api.debts.repay(debtId, amount);
      if (result.settled) {
        setDebts(prev => prev.filter(d => d.id !== debtId));
      } else {
        setDebts(prev => prev.map(d => (d.id === debtId ? result.data : d)));
      }
    } catch (err) {
      console.error("Failed to repay debt:", err);
    }
  };

  const handleUpdateBusiness = async (updatedBiz: Business) => {
    setBusinesses(businesses.map(b => b.id === updatedBiz.id ? updatedBiz : b));
    if (!isGuest) {
      try {
        await api.businesses.update(updatedBiz.id, {
          name: updatedBiz.name,
          industry: updatedBiz.industry,
          logo: updatedBiz.logo,
          primaryColor: updatedBiz.primaryColor,
          taxRate: updatedBiz.taxRate,
          currency: updatedBiz.currency,
          description: updatedBiz.description,
          businessType: updatedBiz.businessType,
          allowFinancialApprovals: updatedBiz.allowFinancialApprovals,
          locked: updatedBiz.locked,
          countryCode: updatedBiz.countryCode,
          timezone: updatedBiz.timezone,
        });
      } catch (err) {
        console.error("Failed to update business:", err);
      }
    }
  };

  const handleCreatePersonalWorkspace = async (name: string, currency: string) => {
    const localId = "pers-" + Math.random().toString(36).substr(2, 5);
    const accountSeeds = [
      { id: "acc-momo-" + Date.now(), name: "My Mobile Money Wallet", type: "MTN Mobile Money" as const, initialBalance: 1500, balance: 1500 },
      { id: "acc-cash-" + Date.now(), name: "Cash Wallet", type: "Cash Wallet" as const, initialBalance: 300, balance: 300 },
      { id: "acc-bank-" + Date.now(), name: "Sovereign Savings Bank", type: "Savings Account" as const, initialBalance: 5000, balance: 5000 }
    ];
    const budgetSeeds = [
      { category: "Food", limitAmount: 600 },
      { category: "Transport", limitAmount: 300 },
      { category: "Rent", limitAmount: 1200 },
      { category: "Utilities", limitAmount: 200 },
      { category: "Entertainment", limitAmount: 150 }
    ];

    if (isGuest) {
      const newBiz: Business = {
        id: localId,
        name: name || "My Personal Finances",
        industry: "Personal Finance",
        logo: "👤",
        primaryColor: "#10b981",
        taxRate: 0,
        currency: currency || "USD",
        description: "Permanently Free Personal Wallet.",
        isPersonal: true,
        accounts: accountSeeds,
        budgets: budgetSeeds
      };
      setBusinesses([...businesses, newBiz]);
      setCurrentBusinessId(localId);
      setShowBrandConfig(false);
      setIsAddingNewBiz(false);
      setActiveTab("dashboard");
      return;
    }

    try {
      const createdBiz = await api.businesses.create({
        name: name || "My Personal Finances",
        industry: "Personal Finance",
        logo: "👤",
        primaryColor: "#10b981",
        taxRate: 0,
        currency: currency || "USD",
        description: "Permanently Free Personal Wallet.",
        isPersonal: true,
      });

      const createdAccounts = await Promise.all(
        accountSeeds.map(seed =>
          api.personalAccounts.create({ businessId: createdBiz.id, name: seed.name, type: seed.type, initialBalance: seed.initialBalance, balance: seed.balance })
        )
      );
      const createdBudgets = await Promise.all(
        budgetSeeds.map(seed =>
          api.personalBudgets.create({ businessId: createdBiz.id, category: seed.category, limitAmount: seed.limitAmount })
        )
      );

      setBusinesses([...businesses, { ...createdBiz, accounts: createdAccounts, budgets: createdBudgets }]);
      setCurrentBusinessId(createdBiz.id);
      setShowBrandConfig(false);
      setIsAddingNewBiz(false);
      setActiveTab("dashboard");
    } catch (err) {
      console.error("Failed to create personal workspace:", err);
    }
  };

  const handleStockAdjustment = async (id: string, delta: number) => {
    setInventory(inventory.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }));
    if (!isGuest) {
      try {
        const updated = await api.inventory.adjust(id, delta);
        setInventory(prev => prev.map(item => (item.id === id ? updated : item)));
      } catch (err) {
        console.error("Failed to adjust stock:", err);
      }
    }
  };

  // Modern Brand Profile updates
  const handleUpdateActiveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizFormName.trim()) return;
    const existing = businesses.find(b => b.id === currentBusinessId);
    if (!existing) return;

    let newLogs = existing.auditLogs || [];
    if (bizFormType === "Company") {
      const actionLog: AuditLog = {
        id: "a-custom-" + Math.random().toString(36).substr(2, 5),
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
        userName: "Active Admin",
        action: "Configuration Updated",
        details: `Updated enterprise settings for ${bizFormName.trim()}.`
      };
      newLogs = [actionLog, ...newLogs];
    }

    const updatedBiz: Business = {
      ...existing,
      name: bizFormName.trim(),
      industry: bizFormIndustry.trim() || "General SME Services",
      currency: bizFormCurrency,
      countryCode: bizFormCountryCode || undefined,
      timezone: bizFormTimezone || undefined,
      taxRate: Number(bizFormTaxRate) || 0,
      logo: bizFormLogo,
      description: bizFormDesc.trim() || "West African compliant SME workspace.",
      businessType: bizFormType,
      partners: bizFormType === "Partnership" ? partners : [],
      shareholders: bizFormType === "Company" ? shareholders : [],
      roles: bizFormType === "Company" ? roles : [],
      allowFinancialApprovals: bizFormType === "Company" ? allowFinancialApprovals : false,
      auditLogs: bizFormType === "Company" ? newLogs : [],
      locked: bizFormLocked
    };

    // handleUpdateBusiness both updates local state and persists the core
    // business fields via the API (nested partners/shareholders/roles/audit
    // logs stay local-only for now - see PR notes).
    handleUpdateBusiness(updatedBiz);
    setShowBrandConfig(false);
  };

  const handleRegisterNewBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizFormName.trim()) return;
    if (isPersonalForm) {
      await handleCreatePersonalWorkspace(bizFormName, bizFormCurrency);
      setIsPersonalForm(false);
      return;
    }
    let initialLogs: AuditLog[] = [];
    if (bizFormType === "Company") {
      initialLogs = [
        {
          id: "a-init",
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 16),
          userName: "Owner Admin",
          action: "Company Registered",
          details: `Registered company profile under name ${bizFormName.trim()}.`
        }
      ];
    }

    const commonFields = {
      name: bizFormName.trim(),
      industry: bizFormIndustry.trim() || "General SME Services",
      currency: bizFormCurrency,
      countryCode: bizFormCountryCode || undefined,
      timezone: bizFormTimezone || undefined,
      taxRate: Number(bizFormTaxRate) || 0,
      logo: bizFormLogo,
      primaryColor: "#2563eb",
      description: bizFormDesc.trim() || "West African compliant SME workspace.",
      businessType: bizFormType,
      allowFinancialApprovals: bizFormType === "Company" ? allowFinancialApprovals : false,
      locked: bizFormLocked,
    };

    if (isGuest) {
      const newBiz: Business = {
        id: "biz-custom-" + Math.random().toString(36).substr(2, 5),
        ...commonFields,
        partners: bizFormType === "Partnership" ? partners : [],
        shareholders: bizFormType === "Company" ? shareholders : [],
        roles: bizFormType === "Company" ? roles : [],
        auditLogs: bizFormType === "Company" ? initialLogs : [],
      };
      setBusinesses([...businesses, newBiz]);
      setCurrentBusinessId(newBiz.id);
      setIsAddingNewBiz(false);
      setShowBrandConfig(false);
      return;
    }

    try {
      const created = await api.businesses.create(commonFields);
      const newBiz: Business = {
        ...created,
        partners: bizFormType === "Partnership" ? partners : [],
        shareholders: bizFormType === "Company" ? shareholders : [],
        roles: bizFormType === "Company" ? roles : [],
        auditLogs: bizFormType === "Company" ? initialLogs : [],
      };
      setBusinesses([...businesses, newBiz]);
      setCurrentBusinessId(newBiz.id);
      setIsAddingNewBiz(false);
      setShowBrandConfig(false);
    } catch (err) {
      console.error("Failed to register business:", err);
    }
  };

  // Real, locale-correct currency symbol via Intl (src/lib/currency.ts) -
  // replaces a hardcoded switch that only recognized GHS/NGN/KES and
  // silently fell back to "$" for every other currency, including ones
  // (USD/EUR/GBP/CAD) this app already claims to support elsewhere.
  const currencySymbol = getCurrencySymbol(currentBusiness.currency);

  // Calculated top-level cash parameters
  const getAvailableCash = () => {
    const plus = transactions
      .filter(t => t.type === "income" && t.businessId === currentBusiness.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const minus = transactions
      .filter(t => t.type === "expense" && t.businessId === currentBusiness.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return Math.max(200, plus - minus); // fallback default
  };

  const availableCash = getAvailableCash();

  // isAuthLoading itself flips the instant Supabase resolves the session
  // check (often from a warm local cache, in well under a frame) - showing
  // the loading screen for that raw duration is what caused it to flash on
  // every page load. This only holds the *visual* gate a little longer; it
  // never delays isAuthLoading itself or anything that depends on it.
  const showAuthLoadingScreen = useMinimumLoadingTime(isAuthLoading, 550);

  // AZIIKI ERROR SYSTEM — maintenance mode blocks everything, before even
  // the auth-loading screen: there's no point letting someone sign in (or
  // sit on the sign-in screen) if the app is about to 503 every request.
  if (maintenanceInfo?.active) {
    return (
      <StatusScreen
        fullScreen
        {...maintenanceStatus(maintenanceInfo.estimatedReturn ?? undefined, () => window.location.reload())}
      />
    );
  }

  if (showAuthLoadingScreen) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto animate-spin border border-emerald-200 text-lg font-black">
            🔄
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest font-mono">Syncing SME Ledger Node</h3>
            <p className="text-xs text-slate-500 mt-2 font-sans">Querying registered user profiles and aligning active ledger entries securely...</p>
          </div>
        </div>
      </div>
    );
  }

  // Both screens below are lazy-loaded (see the imports at the top of this
  // file) - a returning, already-signed-in user never downloads either one
  // again after their first session, so this fallback only ever shows
  // briefly on a first visit or a slow connection.
  const fullScreenFallback = (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto animate-spin border border-emerald-200 text-lg font-black">
          🔄
        </div>
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest font-mono">Loading Aziiki</h3>
      </div>
    </div>
  );

  // First-time visitors see the Ask -> Aha -> Commit onboarding flow before
  // ever hitting the sign-in screen. Returning users (an existing session,
  // guest mode already chosen, or a password-recovery link) skip straight
  // past it - onboarding only ever runs once, tracked via localStorage.
  if (showOnboarding && !user && !isGuest && !needsPasswordRecovery) {
    return (
      <Suspense fallback={fullScreenFallback}>
        <OnboardingFlow
          onFinish={() => setShowOnboarding(false)}
        />
      </Suspense>
    );
  }

  if (needsPasswordRecovery || (!user && !isGuest)) {
    return (
      <Suspense fallback={fullScreenFallback}>
        <AuthPortal
          onAuthSuccess={(info) => {
            setNeedsPasswordRecovery(false);
            handleAuthSuccess(info);
          }}
          onEnterGuest={() => setIsGuest(true)}
          recoveryMode={needsPasswordRecovery}
          linkErrorMessage={authLinkError}
          onDismissLinkError={() => setAuthLinkError(null)}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans selection:bg-brand-navy/15 transition-colors duration-200">
      
      {/* Sticky Left Navigation Sidebar */}
      <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 sticky top-0 z-50 p-4 md:p-6 flex flex-col justify-between md:h-screen md:overflow-y-auto gap-4 shadow-sm transition-colors duration-200 md:shrink-0" id="sidebar-navigation">
        
        {/* Logo and Switcher combo */}
        <div className="flex flex-col gap-4 text-left">
          <div className="flex items-center gap-3">
            <Logo size={36} className="shadow-md rounded-xl" />
            <div>
              <h1 className="text-lg font-black tracking-tighter flex items-center gap-1.5 font-sans text-slate-900">
                Aziiki
              </h1>
              <p className="text-[10px] text-slate-500 mt-0.5 font-sans font-medium">Your Business. Organized.</p>
            </div>
          </div>

          <div className="h-px w-full bg-slate-200"></div>

          {/* Active Business select dropdown switcher */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
              <Building2 className="w-3.5 h-3.5" />
              <span>Enterprise Profile</span>
            </div>
            <select
              id="global-business-switcher"
              value={currentBusinessId}
              onChange={(e) => {
                const targetVal = e.target.value;
                setCurrentBusinessId(targetVal);
                setIsAddingNewBiz(false);
              }}
              className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-sans font-bold cursor-pointer"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id} className="">
                  {b.logo} &nbsp; {b.name} ({b.currency})
                </option>
              ))}
            </select>
            
            <div className="flex gap-1.5 mt-1">
              <button
                onClick={() => {
                  setIsAddingNewBiz(false);
                  setShowBrandConfig(!showBrandConfig);
                }}
                className={`flex-1 p-2 border rounded-xl transition-all cursor-pointer text-[10.5px] font-bold font-sans flex items-center justify-center gap-1 ${
 showBrandConfig && !isAddingNewBiz
 ? "bg-slate-800 text-white border-slate-700 shadow-sm"
 : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
 }`}
                title="Change active enterprise details"
              >
                <span>{currentBusiness?.locked ? "🔒 Locked" : "⚙️ Edit"}</span>
              </button>
              <button
                onClick={() => {
                  setIsAddingNewBiz(true);
                  setShowBrandConfig(true);
                }}
                className="p-2 px-3 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all cursor-pointer text-[10.5px] font-bold font-sans flex items-center justify-center gap-1 shrink-0"
                title="Register another company profile"
              >
                <span>➕ New</span>
              </button>
            </div>
          </div>
        </div>

        {/* Separator line for desktop */}
        <div className="h-px w-full bg-slate-200 hidden md:block"></div>

        {/* Workspace Tab Navigators section */}
        <div className="flex flex-col gap-2 my-2 text-left shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-1.5 hidden md:block">
            Workspace Panels
          </div>
          
          <nav className="flex md:flex-col items-center md:items-stretch gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 custom-scrollbar scrollbar-none text-xs">
            <button
              id="tab-dashboard-btn"
              onClick={() => changeTab("dashboard")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "dashboard"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Layers2 className="w-4 h-4 shrink-0" /> Scorecard
            </button>
            
            <button
              id="tab-billing-btn"
              onClick={() => changeTab("billing")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "billing"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Coins className="w-4 h-4 shrink-0" /> Billing & PDFs
            </button>

            <button
              id="tab-crm-btn"
              onClick={() => changeTab("crm")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "crm"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Users className="w-4 h-4 shrink-0" /> Customer CRM
            </button>

            {/* AZIIKI BASIC VERSION: Wealth & Goals hidden from MVP nav (code preserved below). */}
            {!MVP_MODE && (
            <button
              id="tab-wealth-btn"
              onClick={() => changeTab("wealth")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "wealth"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Target className="w-4 h-4 shrink-0" /> Wealth & Goals
            </button>
            )}

            {/* AZIIKI BASIC VERSION 1.0: Basic Inventory hidden again for launch — the Brutal Product Teardown places it at v1.1, not v1. Code preserved. */}
            {!MVP_MODE && (
            <button
              id="tab-stock-btn"
              onClick={() => changeTab("stock")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "stock"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Warehouse className="w-4 h-4 shrink-0" /> Warehouse Stock
            </button>
            )}

            <button
              id="tab-reports-btn"
              onClick={() => changeTab("reports")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 md:w-full md:justify-start ${
 activeTab === "reports"
 ? "bg-brand-navy text-white shadow-sm shadow-brand-navy/15"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <LineChart className="w-4 h-4 shrink-0" /> Reports & Wisdom
            </button>

            <button
              id="tab-ai-btn"
              onClick={() => changeTab("ai")}
              className={`px-4 py-2.5 rounded-xl font-bold font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 border md:w-full md:justify-start ${
 activeTab === "ai" 
 ? "bg-brand-navy text-white border-brand-navy font-bold" 
 : "text-brand-teal bg-teal-50/70 hover:bg-teal-100/60 border-teal-100"
 }`}
            >
              <BrainCircuit className="w-4 h-4 shrink-0 animate-pulse text-brand-teal" /> CFO AI Advisor
            </button>

            {/* AZIIKI BASIC VERSION: Updates & Growth (ad monetization hub) hidden from MVP nav (code preserved below). */}
            {!MVP_MODE && (
            <button
              id="tab-monetize-btn"
              onClick={() => changeTab("monetize")}
              className={`px-4 py-2.5 rounded-xl font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 border md:w-full md:justify-start ${
 activeTab === "monetize"
 ? "bg-brand-navy text-white border-brand-navy font-bold"
 : "text-slate-600 hover:bg-slate-100"
 }`}
            >
              <Sparkles className="w-4 h-4 shrink-0 text-brand-teal" /> Updates & Growth
            </button>
            )}

            <button
              id="tab-guide-btn"
              onClick={() => changeTab("guide")}
              className={`px-4 py-2.5 rounded-xl font-sans transition-all flex items-center gap-2 cursor-pointer shrink-0 border md:w-full md:justify-start ${
 activeTab === "guide" 
 ? "bg-slate-800 text-white border-slate-700 font-bold" 
 : "text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 border-indigo-150 font-bold"
 }`}
            >
              <BookOpen className="w-4 h-4 shrink-0 text-indigo-600" /> App Guide & Academy
            </button>
          </nav>
        </div>

        {/* User Container Footer Section */}
        <div className="flex md:flex-col items-center md:items-stretch gap-2.5 mt-auto pt-3 border-t border-slate-100">

          {/* AZIIKI DESIGN SYSTEM: theme toggle — pure UI, no data/behavior change. */}
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

          {/* User Account Central State Indicator */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-2.5 w-full transition-colors duration-200 text-left">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-navy to-brand-teal text-white text-xs font-black flex items-center justify-center shadow-md shadow-brand-navy/10 uppercase shrink-0">
                {user ? (user.email?.[0] ?? "U") : "G"}
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="text-[10px] font-bold text-slate-800 truncate max-w-[110px]" title={user ? (user.email ?? "Signed in") : "Guest Session"}>
                  {user ? (user.email ?? "Signed in") : "Guest Session"}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {user ? (
                    <>
                      <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`}></span>
                      <span className="text-[9px] text-slate-550 font-mono">
                        {isSyncing ? "Syncing" : "Cloud Saved"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      <span className="text-[9px] text-amber-600 font-mono font-bold">Offline</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {user ? (
              <button
                onClick={handleLogout}
                title="Sign Out of SME Cloud"
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsGuest(false);
                  setUser(null);
                }}
                className="text-[9px] font-bold text-emerald-600 hover:underline cursor-pointer bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 shrink-0"
              >
                Sync
              </button>
            )}
          </div>
        </div>

      </aside>

      {/* Main Workspace Frame container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full animate-fade-in">
        
        {/* Aziiki Launch Edition Welcome Banner */}
        <div className="mb-6 bg-gradient-to-r from-brand-navy via-brand-teal to-slate-900 border border-brand-teal/35 rounded-2xl p-4 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in" id="launch-edition-promotion-banner">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex items-center gap-3">
            <div className="bg-white/10 text-white w-10 h-10 rounded-xl flex items-center justify-center text-base font-black shrink-0 shadow-inner">
              ✨
            </div>
            <div className="space-y-0.5 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-mono font-bold bg-brand-teal/20 text-brand-teal border border-brand-teal/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Launch Edition
                </span>
                <h4 className="text-xs sm:text-sm font-black tracking-tight">
                  Welcome to Aziiki Launch Edition
                </h4>
              </div>
              <p className="text-[11px] text-slate-300 font-light">
                Streamline your operations with complete multi-currency invoicing, real-time CFO AI advisor audits, and warehouse logistics tracking.
              </p>
            </div>
          </div>
          <button
            onClick={() => changeTab("monetize")}
            className="bg-white hover:bg-slate-50 text-slate-900 font-extrabold text-[10px] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-sm hover:shadow shrink-0 font-sans"
          >
            Explore What's New ➔
          </button>
        </div>

        {/* Traveling-user notice: only when this business has a saved home
            timezone AND it differs from the browser's current one, and the
            user hasn't already dismissed it for this business this session. */}
        {travelNotice && dismissedTravelBannerFor !== currentBusiness.id && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-fade-in text-xs" id="traveling-user-banner">
            <div className="flex items-center gap-2.5">
              <span className="text-base shrink-0">🌍</span>
              <p>
                <span className="font-bold">Looks like you're traveling.</span>{" "}
                Your current timezone is {travelNotice}. Documents you create will still use{" "}
                <strong>{currentBusiness.name}</strong>'s own currency ({currentBusiness.currency}) unless you pick a
                different one for that document.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDismissedTravelBannerFor(currentBusiness.id)}
              aria-label="Dismiss traveling notice"
              className="text-amber-600 hover:text-amber-800 font-bold shrink-0 cursor-pointer px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Aziiki has no SMS/push channel - this is the only in-app signal
            that a payment/low-stock/overdue-invoice email went out. Guest
            mode has no backend session to fetch notifications from. */}
        {!isGuest && <NotificationBanner userEmail={user?.email} />}

        {showBrandConfig && (
          <div className="mb-6 bg-white border-2 border-slate-200/95 rounded-2xl p-5 shadow-lg border-emerald-500/20 text-left animate-fade-in text-xs max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">{isAddingNewBiz ? "🆕" : "⚙️"}</span>
                <div>
                  <h3 className="font-bold text-slate-900 font-sans text-sm">
                    {isAddingNewBiz ? "Register New Company Profile" : "Edit Active Enterprise Brand Details"}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {isAddingNewBiz 
                      ? "Create another separate localized workspace profile for your secondary trade activity." 
                      : "Modify the active example properties to match your real registered business information."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBrandConfig(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={isAddingNewBiz ? handleRegisterNewBrand : handleUpdateActiveBrand} className="space-y-4">
              {/* AZIIKI BASIC VERSION: Personal Workspace toggle hidden — MVP is commercial/SME only. Code preserved. */}
              {isAddingNewBiz && !MVP_MODE && (
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Select Workspace Category</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsPersonalForm(true)}
                      className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
 isPersonalForm ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent"
 }`}
                    >
                      👤 Personal Finances Workspace
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPersonalForm(false)}
                      className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
 !isPersonalForm ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent"
 }`}
                    >
                      🏢 Business SME Workspace
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1 font-sans">
                    {isPersonalForm ? "👤 Permanently FREE personal wallet. Manage salaries, mobile money wallets, savings goals, and monthly budgets." : "🏢 Commercial SME Operating System. Includes Cashbook ledger, CRM, invoicing, dynamic receipts, and stock."}
                  </p>
                </div>
              )}

              {!isPersonalForm && (
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Business Structure / Legal Identity</label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      {(["Sole Proprietor", "Partnership", "Company"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          disabled={bizFormLocked && !isAddingNewBiz}
                          onClick={() => setBizFormType(t)}
                          className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
 bizFormType === t ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent"
 } disabled:opacity-50`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1 font-sans">
                      {bizFormType === "Sole Proprietor" && "Single-owner structure (100% equity). Direct personal dashboard labels (\"My Money\", \"My Profit\")."}
                      {bizFormType === "Partnership" && "Joint-ownership partnership structure. Enables Capital ledger registers and auto-splits profit margins."}
                      {bizFormType === "Company" && "Incorporated structured corporate entity. Features Shareholder capital tables, role delegation controls, and audit trails."}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">
                    {isPersonalForm ? "Workspace / Display Name" : "Company / Brand Name"}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={bizFormLocked && !isAddingNewBiz}
                    value={bizFormName}
                    onChange={(e) => setBizFormName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans font-medium focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-60"
                    placeholder={isPersonalForm ? "e.g. My Personal Wallet" : "e.g. BlueStar Logistics"}
                  />
                </div>
                {!isPersonalForm ? (
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Industry Type / Branch Line</label>
                    <input
                      type="text"
                      disabled={bizFormLocked && !isAddingNewBiz}
                      value={bizFormIndustry}
                      onChange={(e) => setBizFormIndustry(e.target.value)}
                      className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-60"
                      placeholder="e.g. Courier & Freight Branch"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Workspace Category</label>
                    <input
                      type="text"
                      disabled
                      value="Personal Finance"
                      className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans cursor-not-allowed"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Local Base Currency</label>
                  <select
                    disabled={bizFormLocked && !isAddingNewBiz}
                    value={bizFormCurrency}
                    onChange={(e) => setBizFormCurrency(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-2.5 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 cursor-pointer transition-all font-medium text-xs disabled:opacity-60"
                  >
                    <option value="GHS">GHS (₵) Ghana Cedi</option>
                    <option value="NGN">NGN (₦) Nigerian Naira</option>
                    <option value="KES">KES (KSh) Kenyan Shilling</option>
                    <option value="USD">USD ($) US Dollar</option>
                    <option value="EUR">EUR (€) Euro</option>
                    <option value="GBP">GBP (£) British Pound</option>
                  </select>
                </div>
                {!isPersonalForm && (
                  <>
                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Sales VAT / Tax Rate %</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        disabled={bizFormLocked && !isAddingNewBiz}
                        value={bizFormTaxRate}
                        onChange={(e) => setBizFormTaxRate(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans font-mono focus:bg-white focus:border-emerald-500 transition-all disabled:opacity-60"
                        placeholder="e.g. 15"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Brand Logo Icon</label>
                      <div className="flex gap-1.5 items-center">
                        {bizFormLogo.startsWith("data:image/") || bizFormLogo.startsWith("http") ? (
                          <div className="relative shrink-0">
                            <img 
                              src={bizFormLogo} 
                              alt="Uploaded Logo" 
                              className="w-8 h-8 rounded-lg object-contain bg-slate-50 border p-0.5"
                            />
                            {!(bizFormLocked && !isAddingNewBiz) && (
                              <button
                                type="button"
                                onClick={() => setBizFormLogo("💼")}
                                className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[7px] font-bold"
                                title="Clear Image"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="w-8 h-8 bg-slate-150 border rounded-lg flex items-center justify-center text-base shrink-0">
                            {bizFormLogo}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <select
                            disabled={bizFormLocked && !isAddingNewBiz}
                            value={bizFormLogo.startsWith("data:image/") || bizFormLogo.startsWith("http") ? "custom-upload" : bizFormLogo}
                            onChange={(e) => {
                              if (e.target.value !== "custom-upload") {
                                setBizFormLogo(e.target.value);
                              }
                            }}
                            className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-1 py-1.5 outline-none font-sans focus:bg-white focus:border-emerald-500 cursor-pointer transition-all text-[11px] disabled:opacity-60"
                          >
                            <option value="💼">💼 Office/Standard</option>
                            <option value="📸">📸 Creative/Camera</option>
                            <option value="🪡">🪡 Apparel/Tailoring</option>
                            <option value="🎪">🎪 Event/Expo</option>
                            <option value="🥐">🥐 Bakery/Cuisine</option>
                            <option value="🛒">🛒 Retail/Shop</option>
                            <option value="🚘">🚘 Logistics/Transit</option>
                            <option value="🏗️">🏗️ Industry/Builders</option>
                            {(bizFormLogo.startsWith("data:image/") || bizFormLogo.startsWith("http")) && (
                              <option value="custom-upload">🖼️ Custom Logo</option>
                            )}
                          </select>
                          
                          {!(bizFormLocked && !isAddingNewBiz) && (
                            <label className="block text-[8px] text-slate-500 font-sans cursor-pointer bg-slate-100 hover:bg-slate-200 border rounded px-1 py-0.5 mt-0.5 text-center font-bold">
                              Upload Custom Logo File
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                      const dataUrl = event.target?.result as string;
                                      setBizFormLogo(dataUrl);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {!isPersonalForm && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Home Country</label>
                    <select
                      disabled={bizFormLocked && !isAddingNewBiz}
                      value={bizFormCountryCode}
                      onChange={(e) => setBizFormCountryCode(e.target.value)}
                      className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-2.5 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 cursor-pointer transition-all font-medium text-xs disabled:opacity-60"
                    >
                      <option value="">Not set</option>
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Home Timezone</label>
                    <input
                      type="text"
                      disabled={bizFormLocked && !isAddingNewBiz}
                      value={bizFormTimezone}
                      onChange={(e) => setBizFormTimezone(e.target.value)}
                      placeholder="e.g. Africa/Accra"
                      className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all font-mono text-xs disabled:opacity-60"
                    />
                  </div>
                </div>
              )}

              {!isPersonalForm && (
                <div>
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Legal / Compliance Description</label>
                  <textarea
                    rows={2}
                    disabled={bizFormLocked && !isAddingNewBiz}
                    value={bizFormDesc}
                    onChange={(e) => setBizFormDesc(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2 outline-none font-sans focus:bg-white focus:border-emerald-500 transition-all resize-none text-[11px] disabled:opacity-60"
                    placeholder="Compliant SME hub description as displayed on issued PDF receipts..."
                  />
                </div>
              )}

              {/* AZIIKI BASIC VERSION: Partners/Shareholders registry hidden from MVP. Code preserved. */}
              {/* Partnership Configuration Deck */}
              {!MVP_MODE && bizFormType === "Partnership" && (
                <div className="border border-slate-200/80 bg-slate-50/50 rounded-2xl p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs font-sans flex items-center gap-1.5 border-b border-slate-200/60 pb-1.5">
                    👥 Partnership Registry & Capital Splits
                  </h4>
                  
                  <div className="space-y-1.5">
                    {partners.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic">No partners configured yet. Append records below.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white border border-slate-200/60 rounded-xl p-2.5 max-h-40 overflow-y-auto">
                        {partners.map((p) => (
                          <div key={p.id} className="flex justify-between items-center py-1.5 text-[11px]">
                            <div>
                              <strong className="text-slate-800 font-sans">{p.name}</strong>
                              <span className="text-[10px] text-slate-500 ml-2 font-mono font-bold text-emerald-650">Stake: {p.ownershipPercentage}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-slate-500">Paid Capital: {bizFormCurrency} {p.capitalContribution.toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => setPartners(partners.filter(item => item.id !== p.id))}
                                className="text-slate-400 hover:text-rose-600 font-black px-1 text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="font-sans font-bold text-[10px] text-slate-600 flex justify-between px-1">
                      <span>Combined Partners Registry Stake:</span>
                      <span className={partners.reduce((sum, p) => sum + p.ownershipPercentage, 0) === 100 ? "text-emerald-600" : "text-amber-600 animate-pulse font-mono"}>
                        {partners.reduce((sum, p) => sum + p.ownershipPercentage, 0)}% of 100%
                      </span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                    <span className="text-[9px] font-bold font-mono text-slate-400 block uppercase">Append partner stakeholder to register</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <input
                          type="text"
                          placeholder="Partner Name"
                          value={newPartnerName}
                          onChange={(e) => setNewPartnerName(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none font-sans w-full focus:bg-white focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          placeholder="Equity percentage %"
                          value={newPartnerOwnership || ""}
                          onChange={(e) => setNewPartnerOwnership(parseInt(e.target.value) || 0)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none font-mono w-full focus:bg-white focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="GHS Capital"
                          value={newPartnerCapital || ""}
                          onChange={(e) => setNewPartnerCapital(parseInt(e.target.value) || 0)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] outline-none font-mono w-full focus:bg-white focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newPartnerName.trim()) return;
                        const totalCurrent = partners.reduce((sum, p) => sum + p.ownershipPercentage, 0);
                        if (totalCurrent + newPartnerOwnership > 100) {
                          alert(`Warning: Appending this partner results in ${totalCurrent + newPartnerOwnership}% ownership, which exceeds the absolute 100% threshold.`);
                        }
                        const newP: Partner = {
                          id: "p-custom-" + Math.random().toString(36).substr(2, 5),
                          name: newPartnerName.trim(),
                          ownershipPercentage: newPartnerOwnership,
                          capitalContribution: newPartnerCapital,
                          withdrawals: 0
                        };
                        setPartners([...partners, newP]);
                        setNewPartnerName("");
                        setNewPartnerOwnership(25);
                        setNewPartnerCapital(5000);
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-950 text-white font-bold py-2 rounded-xl text-[10px] transition-colors cursor-pointer"
                    >
                      + Commit Partner Allocation
                    </button>
                  </div>
                </div>
              )}

              {/* AZIIKI BASIC VERSION: Shareholders/Roles registry hidden from MVP. Code preserved. */}
              {/* Company Configuration Deck */}
              {!MVP_MODE && bizFormType === "Company" && (
                <div className="border border-slate-200/85 bg-slate-50/50 rounded-2xl p-4 space-y-4">
                  <h4 className="font-bold text-slate-900 text-xs font-sans flex items-center gap-1.5 border-b border-slate-200/60 pb-1.5">
                    ⚙️ Corporate Governance & Team Delegations
                  </h4>

                  {/* Shareholders Registry */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-700 block">📊 Shareholders Ledger & Seed Capital</span>
                    {shareholders.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No shareholders registered. Initialize authorization below.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white border border-slate-200/60 rounded-xl p-2.5 max-h-32 overflow-y-auto">
                        {shareholders.map((sh) => (
                          <div key={sh.id} className="flex justify-between items-center py-1.5 text-[11px]">
                            <div>
                              <strong className="text-slate-800 font-sans">{sh.name}</strong>
                              <span className="text-[10px] text-slate-500 ml-2 font-mono">Holding: {sh.sharesCount.toLocaleString()} common units</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-slate-500">Paid contribution: {bizFormCurrency} {sh.capitalContribution.toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => setShareholders(shareholders.filter(item => item.id !== sh.id))}
                                className="text-slate-400 hover:text-rose-600 font-black px-1 cursor-pointer text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
                      <span className="text-[9px] font-bold font-mono text-slate-450 block uppercase">Enroll Shareholder Contribution</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Shareholder Name"
                          value={newShareholderName}
                          onChange={(e) => setNewShareholderName(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-sans w-full"
                        />
                        <input
                          type="number"
                          placeholder="Shares Units (e.g. 2000)"
                          value={newShareholderShares || ""}
                          onChange={(e) => setNewShareholderShares(parseInt(e.target.value) || 0)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-mono w-full"
                        />
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            placeholder="Capital contribution"
                            value={newShareholderCapital || ""}
                            onChange={(e) => setNewShareholderCapital(parseInt(e.target.value) || 0)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-mono w-full"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newShareholderName.trim()) return;
                              const newSH: Shareholder = {
                                id: "sh-custom-" + Math.random().toString(36).substr(2, 5),
                                name: newShareholderName.trim(),
                                sharesCount: newShareholderShares,
                                capitalContribution: newShareholderCapital,
                                equityValue: newShareholderCapital
                              };
                              setShareholders([...shareholders, newSH]);
                              setNewShareholderName("");
                              setNewShareholderShares(1000);
                              setNewShareholderCapital(15000);
                            }}
                            className="bg-slate-900 text-white font-bold px-3 rounded-lg text-[10px] hover:bg-slate-950 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Team Roles and Permissions */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-700 block">🔐 Role-Based Access Controls</span>
                    {roles.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No custom user roles declared yet. Set permissions below.</p>
                    ) : (
                      <div className="divide-y divide-slate-100 bg-white border border-slate-200/60 rounded-xl p-2.5 max-h-32 overflow-y-auto">
                        {roles.map((r) => (
                          <div key={r.id} className="flex justify-between items-center py-1 text-[11px]">
                            <div>
                              <strong className="text-slate-800 font-sans">{r.name}</strong>
                              <span className="text-[10px] text-slate-500 font-mono ml-2">({r.email})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 font-black rounded text-[9px] uppercase font-mono">{r.role}</span>
                              <button
                                type="button"
                                onClick={() => setRoles(roles.filter(item => item.id !== r.id))}
                                className="text-slate-400 hover:text-rose-600 font-black px-1 cursor-pointer text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-2">
                      <span className="text-[9px] font-bold font-mono text-slate-450 block uppercase">Assign Staff Role Directory</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-sans w-full"
                        />
                        <input
                          type="email"
                          placeholder="Email address"
                          value={newRoleEmail}
                          onChange={(e) => setNewRoleEmail(e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] outline-none font-sans w-full"
                        />
                        <div className="flex gap-1.5">
                          <select
                            value={newRoleType}
                            onChange={(e) => setNewRoleType(e.target.value as any)}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-[10px] outline-none font-sans w-full cursor-pointer"
                          >
                            <option value="Owner">Owner</option>
                            <option value="Admin">Admin</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Staff">Staff</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (!newRoleName.trim() || !newRoleEmail.trim()) return;
                              const newR: UserRole = {
                                id: "r-custom-" + Math.random().toString(36).substr(2, 5),
                                name: newRoleName.trim(),
                                email: newRoleEmail.trim(),
                                role: newRoleType
                              };
                              setRoles([...roles, newR]);
                              setNewRoleName("");
                              setNewRoleEmail("");
                              setNewRoleType("Staff");
                            }}
                            className="bg-slate-900 text-white font-bold px-3 rounded-lg text-[10px] hover:bg-slate-950 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Approvals Workflow switch */}
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-200/60 leading-normal">
                    <input
                      type="checkbox"
                      id="allowApprovalsSwitch"
                      checked={allowFinancialApprovals}
                      onChange={(e) => setAllowFinancialApprovals(e.target.checked)}
                      className="w-3.5 h-3.5 cursor-pointer accent-emerald-600 rounded mt-0.5 shrink-0"
                    />
                    <label htmlFor="allowApprovalsSwitch" className="text-[10px] text-slate-600 font-sans cursor-pointer select-none">
                      Enable <strong>Dual-Signature Financial Approval Process</strong>.<br />
                      Staff adjustments above {bizFormCurrency} 500 will enter pending quarantine until an Admin/Owner approves.
                    </label>
                  </div>
                </div>
              )}

              {/* Brand Profile Locking Feature to prevent accidental changes */}
              {!isPersonalForm && (
                <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl leading-normal">
                  <input
                    type="checkbox"
                    id="lockBrandDetails"
                    checked={bizFormLocked}
                    onChange={(e) => setBizFormLocked(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-emerald-600 rounded shrink-0"
                  />
                  <label htmlFor="lockBrandDetails" className="text-[11px] text-emerald-800 font-sans cursor-pointer select-none">
                    🔒 <strong>Lock Business Profile Details</strong>. Lock this brand layout and details to prevent editing again. This applies to company name, currency, tax rate, and legal profiles across the entire app.
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewBiz(false);
                    setShowBrandConfig(false);
                  }}
                  className="px-4 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                >
                  {isAddingNewBiz ? "Create Brand Profile" : "Apply Brand Changes"}
                </button>
              </div>
            </form>
          </div>
        )}



        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            {/* AZIIKI ERROR SYSTEM — a crash inside any one tab's content
                (a bug in a single screen's render) no longer takes the whole
                app shell (sidebar, nav, header) down with it. "Go to
                Dashboard" here is just changeTab("dashboard"), not a real
                navigation - this app has no router. */}
            <ErrorBoundary
              extraActions={[
                { label: "Go to Dashboard", onClick: () => changeTab("dashboard"), variant: "secondary" },
              ]}
            >
                {activeTab === "dashboard" && (
                  currentBusiness.isPersonal ? (
                    <Suspense fallback={<SkeletonDashboard />}>
                      <PersonalWorkspace
                        currentBusiness={currentBusiness}
                        transactions={transactions}
                        goals={goals}
                        debts={debts}
                        investments={investments}
                        currencySymbol={currencySymbol}
                        onAddTransaction={handleAddTransaction}
                        onDeleteTransaction={handleDeleteTransaction}
                        onAddGoal={handleAddGoal}
                        onAddDebt={handleAddDebt}
                        onAddInvestment={handleAddInvestment}
                        onContributeToGoal={handleContributeToGoal}
                        onUpdateBusiness={handleUpdateBusiness}
                        onDeleteDebt={handleDeleteDebt}
                        onDeleteGoal={handleDeleteGoal}
                        onDeleteInvestment={handleDeleteInvestment}
                        onRepayDebt={handleRepayDebt}
                      />
                    </Suspense>
                  ) : (
                    <BusinessDashboard
                      currentBusiness={currentBusiness}
                      transactions={transactions}
                      customers={customers}
                      invoices={invoices}
                      currencySymbol={currencySymbol}
                      onAddTransaction={handleAddTransaction}
                      onDeleteTransaction={handleDeleteTransaction}
                      onRestoreBackup={handleRestoreBackup}
                      debts={debts}
                    />
                  )
                )}

                {activeTab === "billing" && (
                  <Suspense fallback={<SkeletonTable rows={5} cols={4} />}>
                    <InvoiceReceiptBuilder
                      currentBusiness={currentBusiness}
                      customers={customers}
                      invoices={invoices}
                      receipts={receipts}
                      quotations={quotations}
                      currencySymbol={currencySymbol}
                      onAddInvoice={handleAddInvoice}
                      onAddReceipt={handleAddReceipt}
                      onAddQuotation={handleAddQuotation}
                      onConvertQuote={handleConvertQuoteToInvoice}
                      onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
                    />
                  </Suspense>
                )}

                {activeTab === "crm" && (
                  <Suspense fallback={<SkeletonTable />}>
                    <CustomerCRM
                      currentBusiness={currentBusiness}
                      customers={customers}
                      invoices={invoices}
                      transactions={transactions}
                      currencySymbol={currencySymbol}
                      onAddCustomer={handleAddCustomer}
                      onDeleteCustomer={handleDeleteCustomer}
                    />
                  </Suspense>
                )}

                {/* AZIIKI BASIC VERSION: gated behind MVP_MODE, code preserved for future re-activation. */}
                {!MVP_MODE && activeTab === "wealth" && (
                  <Suspense
                    fallback={
                      <div className="space-y-6">
                        <SkeletonDashboard />
                        <SkeletonDetail />
                      </div>
                    }
                  >
                    <NetWorthInvestments
                      investments={investments}
                      assets={assets}
                      goals={goals}
                      debts={debts}
                      currencySymbol={currencySymbol}
                      totalCash={availableCash}
                      onAddInvestment={handleAddInvestment}
                      onDeleteInvestment={handleDeleteInvestment}
                      onAddAsset={handleAddAsset}
                      onDeleteAsset={handleDeleteAsset}
                      onUpdateAsset={handleUpdateAsset}
                      onAddGoal={handleAddGoal}
                      onDeleteGoal={handleDeleteGoal}
                      onAddDebt={handleAddDebt}
                      onDeleteDebt={handleDeleteDebt}
                      onContributeToGoal={handleContributeToGoal}
                      currentBusiness={currentBusiness}
                    />
                  </Suspense>
                )}

                {/* AZIIKI BASIC VERSION 1.0: Basic Inventory hidden again for launch (Teardown: v1.1, not v1). Code preserved. */}
                {!MVP_MODE && activeTab === "stock" && (
                  <Suspense fallback={<SkeletonTable />}>
                    <InventoryManager
                      currentBusiness={currentBusiness}
                      inventory={inventory}
                      currencySymbol={currencySymbol}
                      onAddInventoryItem={handleAddInventoryItem}
                      onDeleteInventoryItem={handleDeleteInventoryItem}
                      onStockAdjustment={handleStockAdjustment}
                    />
                  </Suspense>
                )}

                {activeTab === "reports" && (
                  <Suspense fallback={<SkeletonDashboard />}>
                    <FinancialReports
                      currentBusiness={currentBusiness}
                      transactions={transactions}
                      goals={goals}
                      investments={investments}
                      currencySymbol={currencySymbol}
                      onContributeToGoal={handleContributeToGoal}
                      onAddTransaction={handleAddTransaction}
                    />
                  </Suspense>
                )}

                {activeTab === "ai" && (
                  <Suspense fallback={<SkeletonDetail />}>
                    <AIFieldAssistant
                      currentBusiness={currentBusiness}
                      transactions={transactions}
                      invoices={invoices}
                      goals={goals}
                      currencySymbol={currencySymbol}
                    />
                  </Suspense>
                )}

                {/* AZIIKI BASIC VERSION: gated behind MVP_MODE, code preserved for future re-activation. */}
                {!MVP_MODE && activeTab === "monetize" && (
                  <Suspense fallback={<SkeletonForm />}>
                    <AdMonetizationHub />
                  </Suspense>
                )}

                {activeTab === "guide" && (
                  <Suspense
                    fallback={
                      <div className="space-y-4">
                        <Skeleton width="40%" height="2rem" />
                        <Skeleton width="100%" height="15rem" />
                      </div>
                    }
                  >
                    <AppGuide />
                  </Suspense>
                )}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>


        {/* Ethical B2B Sustainable monetization banner (Aids monetization logic constraint!) */}
        <footer className="mt-16 bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-between items-center gap-6 text-xs shadow-sm shadow-slate-100/10">
          {/* General terms copyright matches */}
          <div className="w-full font-sans text-slate-500 space-y-1 text-center md:text-left">
            <p>© 2026 Aziiki. Inspired by global professional ledger standards.</p>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Aziiki utilizes secure local browser sandbox indexing with backend node server compliance. Compatible with major African mobile money and bank SMS formats.
            </p>
          </div>
        </footer>

      </main>

    </div>
  );
}
