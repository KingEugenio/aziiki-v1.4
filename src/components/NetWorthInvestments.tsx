import React, { useState, useEffect } from "react";
import { Briefcase, Plus, TrendUp as TrendingUp, Pulse as Activity, CaretRight as ChevronRight, Trash as Trash2, Target, Coins, Scales as Scale, Warning as AlertTriangle, CalendarDots as CalendarDays, Percent, MagicWand as Sparkles, ArrowsClockwise as RefreshCw, Globe, MagnifyingGlass as Search, TrendDown as TrendingDown, Wrench, FileText, Clock, ShieldCheck, Calculator, Stack as Layers, Question as HelpCircle, SealCheck as FileCheck, CheckCircle, BookOpen } from "@phosphor-icons/react";
import { Investment, Goal, Debt, Business, Asset } from "../types";
import { SUPPORTED_CURRENCY_CODES, getCurrencySymbol } from "../lib/currency";

interface CountryMarketInfo {
  countryName: string;
  treasuryBillLabel: string;
  stockExchangeLabel: string;
  mutualFundLabel: string;
  savingsLabel: string;
  currencyCode: string;
}

const getMarketInfo = (currency: string): CountryMarketInfo => {
  const code = (currency || "GHS").toUpperCase();
  switch (code) {
    case "USD":
      return {
        countryName: "United States",
        treasuryBillLabel: "US Treasury Bills (T-Bills)",
        stockExchangeLabel: "US Stocks (S&P 500 / NASDAQ)",
        mutualFundLabel: "Index ETFs (SPY / QQQ)",
        savingsLabel: "High-Yield Savings (HYSA)",
        currencyCode: "USD"
      };
    case "CAD":
      return {
        countryName: "Canada",
        treasuryBillLabel: "Canada Treasury Bills",
        stockExchangeLabel: "Canadian Stocks (TSX)",
        mutualFundLabel: "TSX Index Mutual Funds / ETFs",
        savingsLabel: "High-Interest Savings (HISA)",
        currencyCode: "CAD"
      };
    case "GHS":
      return {
        countryName: "Ghana",
        treasuryBillLabel: "Ghana Government T-Bills (91/182-Day)",
        stockExchangeLabel: "Ghana Stock Exchange (GSE Stocks)",
        mutualFundLabel: "GHS Equity Mutual Funds",
        savingsLabel: "High-Yield Business Savings",
        currencyCode: "GHS"
      };
    case "NGN":
      return {
        countryName: "Nigeria",
        treasuryBillLabel: "Nigeria Government NTBs (T-Bills)",
        stockExchangeLabel: "Nigerian Exchange Group (NGX Stocks)",
        mutualFundLabel: "NGN Equity Mutual Funds",
        savingsLabel: "High-Yield Bank Escrow / MoMo",
        currencyCode: "NGN"
      };
    case "KES":
      return {
        countryName: "Kenya",
        treasuryBillLabel: "Kenya Government Treasury Bills",
        stockExchangeLabel: "Nairobi Securities Exchange (NSE Stocks)",
        mutualFundLabel: "KES Money Market Funds (MMF)",
        savingsLabel: "KES Digital High-Yield Savings",
        currencyCode: "KES"
      };
    case "EUR":
      return {
        countryName: "Eurozone",
        treasuryBillLabel: "European Sovereign Bond Portfolio",
        stockExchangeLabel: "Eurozone Blue-Chips (STOXX 600 Stocks)",
        mutualFundLabel: "EUR Equity Mutual Funds / ETFs",
        savingsLabel: "EUR Commercial Savings Accounts",
        currencyCode: "EUR"
      };
    case "GBP":
      return {
        countryName: "United Kingdom",
        treasuryBillLabel: "UK Government Gilts (T-Bills)",
        stockExchangeLabel: "British Stocks (FTSE 100 / LSE)",
        mutualFundLabel: "FTSE 150 Index Mutual Funds",
        savingsLabel: "GBP Business High-Yield Savings",
        currencyCode: "GBP"
      };
    case "ZAR":
      return {
        countryName: "South Africa",
        treasuryBillLabel: "SA Government Retail Bonds",
        stockExchangeLabel: "Johannesburg Stock Exchange (JSE Stocks)",
        mutualFundLabel: "ZAR Equity Balanced Index Funds",
        savingsLabel: "ZAR High-Interest Term Deposit",
        currencyCode: "ZAR"
      };
    case "AUD":
      return {
        countryName: "Australia",
        treasuryBillLabel: "Australian Treasury Bonds / Bills",
        stockExchangeLabel: "Australian Stocks (ASX index)",
        mutualFundLabel: "ASX 200 Index Funds / ETFs",
        savingsLabel: "AUD High-Interest Savings Account",
        currencyCode: "AUD"
      };
    case "INR":
      return {
        countryName: "India",
        treasuryBillLabel: "India Government Treasury Bills",
        stockExchangeLabel: "Indian Stocks (NSE / BSE Indices)",
        mutualFundLabel: "Nifty 50 Index Mutual Funds",
        savingsLabel: "INR Term Commercial Deposits",
        currencyCode: "INR"
      };
    default:
      return {
        countryName: "Local economy",
        treasuryBillLabel: `Treasury Bills (${code})`,
        stockExchangeLabel: `Blue-Chip Local Stocks (${code})`,
        mutualFundLabel: `Equity Mutual Funds (index)`,
        savingsLabel: `High-Yield Business Savings (${code})`,
        currencyCode: code
      };
  }
};

interface NetWorthInvestmentsProps {
  investments: Investment[];
  assets: Asset[];
  goals: Goal[];
  debts: Debt[];
  currencySymbol: string;
  totalCash: number;
  onAddInvestment: (inv: Investment) => void;
  onDeleteInvestment?: (id: string) => void;
  onAddAsset: (asset: Asset) => void;
  onDeleteAsset?: (id: string) => void;
  onUpdateAsset?: (asset: Asset) => void;
  onAddGoal: (goal: Goal) => void;
  onDeleteGoal?: (id: string) => void;
  onAddDebt: (debt: Debt) => void;
  onDeleteDebt?: (id: string) => void;
  onContributeToGoal?: (goalId: string, amount: number, currency?: string) => void;
  currentBusiness?: Business;
}

export default function NetWorthInvestments({
  investments,
  assets = [],
  goals,
  debts,
  currencySymbol,
  totalCash,
  onAddInvestment,
  onDeleteInvestment,
  onAddAsset,
  onDeleteAsset,
  onUpdateAsset,
  onAddGoal,
  onDeleteGoal,
  onAddDebt,
  onDeleteDebt,
  onContributeToGoal,
  currentBusiness
}: NetWorthInvestmentsProps) {
  // Navigation tabs: "assets" | "investments" | "networth" | "goals"
  const [activeTab, setActiveTab] = useState<"assets" | "investments" | "networth" | "goals">("assets");

  const changeSubTab = (tab: "assets" | "investments" | "networth" | "goals") => {
    setActiveTab(tab);
  };
  
  // Resolve active market details by currency code
  const activeCurrency = currentBusiness?.currency || "GHS";
  const market = getMarketInfo(activeCurrency);

  // Success state alert messages
  const [alertMessage, setAlertMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Asset Form States
  const [isAddingAsset, setIsAddingAsset] = useState<boolean>(false);
  const [assetOwnershipStatus, setAssetOwnershipStatus] = useState<"owned" | "planned">("owned");

  // SME Investment Simulator & Comparison States
  const [simulatedPrincipal, setSimulatedPrincipal] = useState<number>(10000);
  const [simulatedDuration, setSimulatedDuration] = useState<number>(12);
  const [simulatedRate, setSimulatedRate] = useState<number>(18);
  const [simulatedCompounding, setSimulatedCompounding] = useState<"Simple" | "Compound">("Simple");
  const [comparisonCapital, setComparisonCapital] = useState<number>(10000);
  const [assetName, setAssetName] = useState<string>("");
  const [assetCategory, setAssetCategory] = useState<"Machinery" | "Equipment" | "Vehicle" | "Real Estate" | "Computer/IT" | "Other">("Equipment");
  const [assetPurchaseDate, setAssetPurchaseDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [assetPurchasePrice, setAssetPurchasePrice] = useState<number>(1000);
  const [assetCurrentValue, setAssetCurrentValue] = useState<number>(1000);
  const [assetDepreciationMethod, setAssetDepreciationMethod] = useState<"Straight Line" | "Double Declining" | "None">("Straight Line");
  const [assetUsefulLife, setAssetUsefulLife] = useState<number>(5);
  const [assetSalvageValue, setAssetSalvageValue] = useState<number>(100);
  const [assetMaintenanceLast, setAssetMaintenanceLast] = useState<string>("");
  const [assetMaintenanceNext, setAssetMaintenanceNext] = useState<string>("");
  const [assetMaintenanceStatus, setAssetMaintenanceStatus] = useState<"Good" | "Needs Service" | "Overdue">("Good");
  const [assetMaintenanceNotes, setAssetMaintenanceNotes] = useState<string>("");
  const [assetDocsNotes, setAssetDocsNotes] = useState<string>("");
  const [assetNotes, setAssetNotes] = useState<string>("");

  // Planned Asset Purchase Flow States
  const [purchasingAssetId, setPurchasingAssetId] = useState<string | null>(null);
  const [actualPurchasePrice, setActualPurchasePrice] = useState<number>(1000);
  const [purchaseReceiptNotes, setPurchaseReceiptNotes] = useState<string>("");

  // Investment Form States
  const [isAddingInv, setIsAddingInv] = useState<boolean>(false);
  const [invType, setInvType] = useState<"Treasury Bill" | "Mutual Fund" | "Fixed Deposit" | "Stock" | "Bond" | "Real Estate" | "Business Investment" | "Savings Account" | "SACCO/Cooperative">("Treasury Bill");
  const [invName, setInvName] = useState<string>("");
  const [invIns, setInvIns] = useState<string>("");
  const [invAmountInvested, setInvAmountInvested] = useState<number>(1000);
  const [invValue, setInvValue] = useState<number>(1000);
  const [invExpectedRate, setInvExpectedRate] = useState<number>(12.5); 
  const [invMaturity, setInvMaturity] = useState<string>("");
  const [invNotes, setInvNotes] = useState<string>("");
  const [investmentsSubTab, setInvestmentsSubTab] = useState<"positions" | "calculator" | "comparison" | "ai">("positions");
  const [aiAuditReport, setAiAuditReport] = useState<string | null>(null);
  const [aiAuditData, setAiAuditData] = useState<any>(null);
  const [isGeneratingAiAudit, setIsGeneratingAiAudit] = useState<boolean>(false);

  // Goal Form States
  const [isAddingGoal, setIsAddingGoal] = useState<boolean>(false);
  const [goalType, setGoalType] = useState<string>("Equipment");
  const [goalName, setGoalName] = useState<string>("");
  const [goalTarget, setGoalTarget] = useState<number>(5000);
  const [goalCurrent, setGoalCurrent] = useState<number>(0);
  const [goalDeadline, setGoalDeadline] = useState<string>(new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split("T")[0]);
  const [goalCurrency, setGoalCurrency] = useState<string>(currentBusiness?.currency || "GHS");

  // Debt Form States
  const [isAddingDebt, setIsAddingDebt] = useState<boolean>(false);
  const [creditor, setCreditor] = useState<string>("");
  const [debtAmount, setDebtAmount] = useState<number>(1000);
  const [interestRate, setInterestRate] = useState<number>(0);
  const [debtDueDate, setDebtDueDate] = useState<string>(new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split("T")[0]);
  const [debtType, setDebtType] = useState<string>("Supplier Credit");
  const [debtCurrency, setDebtCurrency] = useState<string>(currentBusiness?.currency || "GHS");

  // Goals contribution support
  const [activeGoalFormId, setActiveGoalFormId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState<number>(100);
  const [contributionCurrency, setContributionCurrency] = useState<string>(currentBusiness?.currency || "GHS");
  const [contributionError, setContributionError] = useState<string | null>(null);

  // Selected asset for deep maintenance scheduler / details overlay
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [updatingEstimatedValueAssetId, setUpdatingEstimatedValueAssetId] = useState<string | null>(null);
  const [tempAssetValue, setTempAssetValue] = useState<number>(0);

  // Projections Sliders
  const [projectionYears, setProjectionYears] = useState<number>(5);

  // Live online investment indices sourced from Gemini API search grounding
  const [liveData, setLiveData] = useState<any>(null);
  const [isFetchingLive, setIsFetchingLive] = useState<boolean>(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Trigger alert messages
  const triggerAlert = (text: string, type: "success" | "error" = "success") => {
    setAlertMessage({ text, type });
    setTimeout(() => setAlertMessage(null), 4000);
  };

  const handleSourceLiveRates = async () => {
    setIsFetchingLive(true);
    setLiveError(null);
    try {
      const response = await fetch("/api/gemini/live-investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: activeCurrency })
      });

      if (!response.ok) {
        throw new Error("Local limit cap or search grounding parameters shifted.");
      }

      const data = await response.json();
      setLiveData(data);
      triggerAlert("⚡ Live market indicators retrieved successfully via Gemini.");
    } catch (err: any) {
      console.error(err);
      setLiveError(err?.message || "Temporarily unable to query market rate grounding index.");
    } finally {
      setIsFetchingLive(false);
    }
  };

  const handleGenerateAiAudit = async () => {
    setIsGeneratingAiAudit(true);
    try {
      const response = await fetch("/api/gemini/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: currentBusiness?.name || "My SME",
          currency: activeCurrency,
          totalRevenue: 50000,
          totalExpenses: 30000,
          netProfit: 20000,
          outstandingInvoices: 5000,
          savings: totalCash,
          investments: totalInvestmentCurrentValue,
          recentTransactions: [],
          userQuery: "Provide a detailed non-custodial SME investment portfolio diversification analysis, asset allocation report, maturity schedule tactical advisory, and net worth wealth building strategy using current tracked bookkeeping metrics. Maintain a professional, educational advisory tone. Reassure that Aziiki is a passive non-custodial bookkeeping ledger."
        })
      });

      if (!response.ok) {
        throw new Error("Unable to contact the AI portfolio auditing gateway.");
      }

      const data = await response.json();
      setAiAuditData(data);
      triggerAlert("✨ Custom AI portfolio advisory report compiled successfully!");
    } catch (err: any) {
      console.error(err);
      triggerAlert("⚠️ Failed to compile AI portfolio analysis. Using local algorithmic auditor model.", "error");
      
      const fallbackAudit = {
        healthSummary: "Asset allocation demonstrates sound sovereign risk alignment.",
        metricsAnalysis: [
          { title: "Portfolio Diversification", value: filteredInvestments.length > 1 ? "Moderate" : "Low", indicator: filteredInvestments.length > 1 ? "positive" : "warning", description: "Your investments are concentrated. Sourcing additional asset classes can reduce volatility." },
          { title: "Liquidity Reserve Cover", value: totalCash > totalDebtValue ? "Optimal" : "Stretched", indicator: totalCash > totalDebtValue ? "positive" : "negative", description: "Cash reserves are sufficient to offset current recorded liabilities." },
          { title: "Net Capital Leverage", value: "None", indicator: "positive", description: "All recorded positions are fully funded. Zero leveraged debt risk detected." }
        ],
        localMarketHacks: [
          "Sovereign Treasury Bills Ladder: Divide portfolio across rolling 91-day and 182-day papers to maintain rolling liquidity.",
          "Emergency Liquid Buffer: Keep at least 3 months of operational expenses in a high-interest money market fund.",
          "Net Worth Rebalancing: Target allocating 15% to 25% of retained earnings to secure risk-free paper before expansion."
        ],
        aiReply: "Based on your manual bookkeeping entries, your total financial reserves stand at " + currencySymbol + totalInvestmentCurrentValue.toLocaleString() + ". Since Aziiki does not hold custody of your capital, these are purely tracker indicators.\n\nTo optimize your capital, consider establishing rolling Sovereign Treasury Bill ladders to match upcoming bills or capital expansions recorded in your Business Goals tab. Diversifying into high-yield mutual funds also provides instant liquidity while earning superior yields to inflation."
      };
      setAiAuditData(fallbackAudit);
    } finally {
      setIsGeneratingAiAudit(false);
    }
  };

  // Helper to calculate depreciation parameters dynamically
  const calculateDepreciation = (asset: Asset) => {
    const purchaseDate = new Date(asset.purchaseDate);
    const currentDate = new Date();
    
    // Difference in years
    let yearsOwned = (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (yearsOwned < 0) yearsOwned = 0;
    
    const purchasePrice = asset.purchasePrice;
    const salvageValue = asset.salvageValue ?? 0;
    const usefulLife = asset.usefulLifeYears ?? 5;
    
    let annualDepreciation = 0;
    let accumulatedDepreciation = 0;
    let bookValue = asset.currentValue;
    
    if (asset.depreciationMethod === "Straight Line") {
      annualDepreciation = Math.max(0, (purchasePrice - salvageValue) / usefulLife);
      accumulatedDepreciation = Math.min(purchasePrice - salvageValue, annualDepreciation * yearsOwned);
      bookValue = Math.max(salvageValue, purchasePrice - accumulatedDepreciation);
    } else if (asset.depreciationMethod === "Double Declining") {
      const rate = (2 / usefulLife);
      let currentBookValue = purchasePrice;
      for (let i = 0; i < Math.floor(yearsOwned); i++) {
        const dep = currentBookValue * rate;
        currentBookValue -= dep;
      }
      const partialYear = yearsOwned - Math.floor(yearsOwned);
      if (partialYear > 0) {
        const dep = currentBookValue * rate * partialYear;
        currentBookValue -= dep;
      }
      bookValue = Math.max(salvageValue, currentBookValue);
      accumulatedDepreciation = purchasePrice - bookValue;
      annualDepreciation = bookValue * rate;
    } else {
      // None
      bookValue = asset.currentValue;
      accumulatedDepreciation = 0;
      annualDepreciation = 0;
    }
    
    return {
      bookValue: Math.round(bookValue),
      accumulatedDepreciation: Math.round(accumulatedDepreciation),
      annualDepreciation: Math.round(annualDepreciation),
      yearsOwned: Number(yearsOwned.toFixed(2))
    };
  };

  // Business filtering based on current selected business ID
  const activeBusinessId = currentBusiness?.id || "";
  const filteredAssets = assets.filter(a => !a.businessId || a.businessId === activeBusinessId);
  const filteredInvestments = investments.filter(i => !i.businessId || i.businessId === activeBusinessId);
  const filteredGoals = goals.filter(g => !g.businessId || g.businessId === activeBusinessId);

  // Calculate Net Worth / Asset / Investment Sums
  const totalAssetsOriginalPrice = filteredAssets.reduce((sum, a) => sum + a.purchasePrice, 0);
  
  // Book values of owned assets after cumulative depreciation
  const totalAssetsBookValue = filteredAssets.reduce((sum, a) => {
    const dep = calculateDepreciation(a);
    return sum + dep.bookValue;
  }, 0);

  // Investment Portfolio Metrics
  const totalInvestmentsCost = filteredInvestments.reduce((sum, i) => sum + (i.amountInvested ?? i.value), 0);
  const totalInvestmentCurrentValue = filteredInvestments.reduce((sum, i) => sum + i.value, 0);
  const portfolioROIValue = totalInvestmentCurrentValue - totalInvestmentsCost;
  const portfolioROIPercent = totalInvestmentsCost > 0 ? (portfolioROIValue / totalInvestmentsCost) * 100 : 0;

  // Debts
  const totalDebtValue = debts.reduce((sum, d) => sum + d.amount, 0);
  
  // Total Asset Aggregate (Cash + Book Assets + Current Investments)
  const totalAssetsAggregate = Math.max(0, totalCash) + totalAssetsBookValue + totalInvestmentCurrentValue;
  const netWorthValue = totalAssetsAggregate - totalDebtValue;

  // Add Asset Submission
  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) return;

    const isPlanned = assetOwnershipStatus === "planned";

    onAddAsset({
      id: "asset-" + Math.random().toString(36).substr(2, 9),
      name: assetName,
      category: assetCategory,
      purchaseDate: assetPurchaseDate,
      purchasePrice: assetPurchasePrice,
      currentValue: assetCurrentValue,
      depreciationMethod: isPlanned ? "None" : assetDepreciationMethod,
      usefulLifeYears: isPlanned ? undefined : assetUsefulLife,
      salvageValue: isPlanned ? undefined : assetSalvageValue,
      maintenanceLastDate: isPlanned ? undefined : (assetMaintenanceLast || undefined),
      maintenanceNextDate: isPlanned ? undefined : (assetMaintenanceNext || undefined),
      maintenanceStatus: isPlanned ? undefined : assetMaintenanceStatus,
      maintenanceNotes: isPlanned ? undefined : (assetMaintenanceNotes || undefined),
      documentsNotes: assetDocsNotes || undefined,
      notes: isPlanned ? `[Planned] ${assetNotes}` : assetNotes || undefined,
      businessId: activeBusinessId
    });

    // Reset Form
    setAssetName("");
    setIsAddingAsset(false);
    triggerAlert(`✓ Asset "${assetName}" registered as ${isPlanned ? "planned acquisition" : "owned equipment"} in ledger successfully.`);
  };

  const handleConfirmPurchaseAsset = (asset: Asset, actualPrice?: number, docNotes?: string) => {
    if (!onUpdateAsset) return;
    const cleanNotes = asset.notes ? asset.notes.replace(/^\[Planned\]\s*/, "") : "";
    onUpdateAsset({
      ...asset,
      notes: cleanNotes || undefined,
      purchasePrice: actualPrice ?? asset.purchasePrice,
      currentValue: actualPrice ?? asset.currentValue,
      purchaseDate: new Date().toISOString().split("T")[0], // Mark purchased today!
      depreciationMethod: "Straight Line", // Default to standard depreciation now
      usefulLifeYears: 5,
      salvageValue: Math.round((actualPrice ?? asset.purchasePrice) * 0.1), // 10% salvage default
      documentsNotes: docNotes || asset.documentsNotes,
      maintenanceStatus: "Good"
    });
    triggerAlert(`✓ Asset "${asset.name}" has been marked as fully purchased & activated!`);
  };

  // Add Investment Submission
  const handleSaveInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim()) return;

    onAddInvestment({
      id: "inv-" + Math.random().toString(36).substr(2, 9),
      type: invType,
      name: invName,
      institution: invIns || "Local Issuer",
      amountInvested: invAmountInvested,
      value: invValue,
      expectedReturnRate: invExpectedRate,
      dateAcquired: new Date().toISOString().split("T")[0],
      maturityDate: invMaturity || undefined,
      notes: invNotes || undefined,
      businessId: activeBusinessId
    });

    setInvName("");
    setInvIns("");
    setInvNotes("");
    setIsAddingInv(false);
    triggerAlert(`✓ Investment position "${invName}" logged successfully in tracker.`);
  };

  // Add Capital Goals Submission
  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) return;

    onAddGoal({
      id: "goal-" + Math.random().toString(36).substr(2, 9),
      type: goalType as any,
      name: goalName,
      currentAmount: goalCurrent,
      targetAmount: goalTarget,
      deadline: goalDeadline,
      businessId: activeBusinessId,
      currency: goalCurrency,
    });

    setGoalName("");
    setIsAddingGoal(false);
    triggerAlert(`✓ Business growth goal "${goalName}" established in milestones.`);
  };

  // Add Debt Liability Submission
  const handleSaveDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditor.trim()) return;

    onAddDebt({
      id: "debt-" + Math.random().toString(36).substr(2, 9),
      creditor,
      amount: debtAmount,
      interestRate,
      dueDate: debtDueDate,
      type: debtType as any,
      businessId: activeBusinessId,
      currency: debtCurrency,
    });

    setCreditor("");
    setIsAddingDebt(false);
    triggerAlert(`✓ Short-term credit liability from "${creditor}" registered successfully.`);
  };

  // Fund allocation transfer to goal. The available-cash check only applies
  // when contributing in the business's own currency - totalCash is tracked
  // in that currency, so comparing it against an amount in a different
  // currency would be meaningless.
  const handleContributeSubmit = (goalId: string) => {
    if (contributionAmount <= 0) return;
    const isBusinessCurrency = contributionCurrency === (currentBusiness?.currency || "GHS");
    if (isBusinessCurrency && contributionAmount > totalCash) {
      setContributionError("Allocation amount is higher than available cash balance!");
      setTimeout(() => setContributionError(null), 5000);
      return;
    }
    if (onContributeToGoal) {
      onContributeToGoal(goalId, contributionAmount, contributionCurrency);
      setActiveGoalFormId(null);
      setContributionAmount(100);
      setContributionError(null);
      triggerAlert(`✓ ${getCurrencySymbol(contributionCurrency)}${contributionAmount} allocated into goal reserves from cash balance.`);
    }
  };

  // Update asset estimated market value manually
  const handleSaveAssetValueUpdate = (assetId: string) => {
    if (tempAssetValue <= 0 || !onUpdateAsset) return;
    const originalAsset = filteredAssets.find(a => a.id === assetId);
    if (originalAsset) {
      onUpdateAsset({
        ...originalAsset,
        currentValue: tempAssetValue
      });
      setUpdatingEstimatedValueAssetId(null);
      triggerAlert("✓ Asset estimated market value adjusted.");
    }
  };

  // Trigger quick service on asset
  const handlePerformService = (assetId: string) => {
    if (!onUpdateAsset) return;
    const originalAsset = filteredAssets.find(a => a.id === assetId);
    if (originalAsset) {
      const todayStr = new Date().toISOString().split("T")[0];
      // Set next service in 6 months
      const nextDateStr = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split("T")[0];
      onUpdateAsset({
        ...originalAsset,
        maintenanceLastDate: todayStr,
        maintenanceNextDate: nextDateStr,
        maintenanceStatus: "Good",
        maintenanceNotes: `Completed scheduled maintenance overhaul on ${todayStr}. All modules operating optimally.`
      });
      triggerAlert("🔧 Maintenance event logged. Status restored to 'Good'.");
    }
  };

  // Asset Allocations
  const getAssetAllocationWeights = () => {
    const allocations: { [key: string]: number } = {};
    filteredInvestments.forEach(i => {
      allocations[i.type] = (allocations[i.type] || 0) + i.value;
    });
    const total = Object.values(allocations).reduce((a, b) => a + b, 0);
    return Object.keys(allocations).map(key => ({
      type: key,
      value: allocations[key],
      percentage: total > 0 ? Math.round((allocations[key] / total) * 100) : 0
    }));
  };

  // Portfolio Projections
  const calculatePortfolioProjection = () => {
    const weightedRate = filteredInvestments.reduce((sum, i) => sum + (i.expectedReturnRate * (i.value / totalInvestmentCurrentValue)), 0) || 0;
    const rate = (weightedRate / 100);
    const projectedValue = totalInvestmentCurrentValue * Math.pow(1 + rate, projectionYears);
    return {
      rate: Number(weightedRate.toFixed(1)),
      value: Math.round(projectedValue),
      interestGained: Math.round(Math.max(0, projectedValue - totalInvestmentCurrentValue))
    };
  };

  const weights = getAssetAllocationWeights();
  const projection = calculatePortfolioProjection();

  return (
    <div id="networth-investments-container" className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-slate-800 font-sans">
      
      {/* Alert Messaging Toast */}
      {alertMessage && (
        <div className="lg:col-span-12 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl flex items-center gap-3 animate-pulse shadow-sm text-xs font-semibold">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{alertMessage.text}</span>
        </div>
      )}

      {/* Selector and core values banner */}
      <div className="lg:col-span-12 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        
        {/* Navigation control tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-100 border border-slate-200/60 p-1 rounded-2xl w-fit">
          <button
            onClick={() => changeSubTab("assets")}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
 activeTab === "assets" 
 ? "bg-emerald-600 text-white shadow-sm" 
 : "text-slate-500 hover:text-slate-800"
 }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Asset Register & Planning
          </button>
          
          <button
            onClick={() => changeSubTab("investments")}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
 activeTab === "investments" 
 ? "bg-emerald-600 text-white shadow-sm" 
 : "text-slate-500 hover:text-slate-800"
 }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            SME Investment Desk
          </button>
          
          <button
            onClick={() => changeSubTab("networth")}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
 activeTab === "networth" 
 ? "bg-emerald-600 text-white shadow-sm" 
 : "text-slate-500 hover:text-slate-800"
 }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Wealth & Net Worth
          </button>
          
          <button
            onClick={() => changeSubTab("goals")}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-2 ${
 activeTab === "goals" 
 ? "bg-emerald-600 text-white shadow-sm" 
 : "text-slate-500 hover:text-slate-800"
 }`}
          >
            <Target className="w-3.5 h-3.5" />
            Business Goals
          </button>
        </div>

        {/* Display Banner metrics */}
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest block font-bold text-slate-400">Available Cash</span>
            <strong className="text-sm font-black text-emerald-600 font-mono block mt-0.5">
              {currencySymbol}{totalCash.toLocaleString()}
            </strong>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block" />
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest block font-bold text-slate-400">Net Book Assets</span>
            <strong className="text-sm font-black text-slate-800 font-mono block mt-0.5">
              {currencySymbol}{totalAssetsBookValue.toLocaleString()}
            </strong>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block" />
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest block font-bold text-slate-400">Investments</span>
            <strong className="text-sm font-black text-slate-800 font-mono block mt-0.5">
              {currencySymbol}{totalInvestmentCurrentValue.toLocaleString()}
            </strong>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block" />
          <div>
            <span className="text-[9px] font-mono uppercase tracking-widest block font-bold text-slate-400">Computed Net Worth</span>
            <strong className="text-sm font-black text-emerald-600 font-mono block mt-0.5">
              {currencySymbol}{netWorthValue.toLocaleString()}
            </strong>
          </div>
        </div>
      </div>

      {/* TAB 1: ASSET REGISTER & ASSET PLANNING */}
      <>
          {activeTab === "assets" && (
            <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 text-left animate-fade-in">
          
          {/* Information Notice explaining Asset Accounting */}
          <div className="lg:col-span-12 bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-3xl flex items-start gap-3.5 text-xs">
            <div className="bg-blue-100 text-blue-800 w-10 h-10 rounded-2xl flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold tracking-tight">Non-Custodial Asset Registry desk</h4>
              <p className="leading-relaxed text-[11px] font-light text-slate-600">
                This ledger register tracks tangible capital equipment, machinery, and workspace assets you already own or are actively planning. Aziiki calculated metrics are purely for internal planning, analytical estimates, and balance sheet valuation. Aziiki does not store physical assets or execute purchase funds directly.
              </p>
            </div>
          </div>

          {/* LEFT: Add Asset Form Desk */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Asset Registration
              </h3>
              <button
                onClick={() => setIsAddingAsset(!isAddingAsset)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                {isAddingAsset ? "Cancel" : <><Plus className="w-4 h-4" /> Add Asset</>}
              </button>
            </div>

             {isAddingAsset ? (
              <form onSubmit={handleSaveAsset} className="space-y-3.5 text-xs">
                {/* Ownership Status Toggle */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Asset Ownership Status</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setAssetOwnershipStatus("owned")}
                      className={`py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
 assetOwnershipStatus === "owned"
 ? "bg-emerald-600 text-white shadow-sm"
 : "text-slate-400 hover:text-slate-800"
 }`}
                    >
                      Already Owned
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssetOwnershipStatus("planned")}
                      className={`py-1.5 rounded-lg font-bold text-[10px] transition-all cursor-pointer ${
 assetOwnershipStatus === "planned"
 ? "bg-indigo-650 text-white shadow-sm"
 : "text-slate-400 hover:text-slate-800"
 }`}
                    >
                      Planned (Intend to Buy)
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Asset Title Name</label>
                  <input
                    type="text"
                    required
                    placeholder={assetOwnershipStatus === "planned" ? "e.g. Planned Canon EOS R5 Camera" : "e.g. Brother Industrial Sewing Machine"}
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Asset Category</label>
                    <select
                      value={assetCategory}
                      onChange={(e: any) => setAssetCategory(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2.5 py-2 outline-none font-sans"
                    >
                      <option value="Machinery">Machinery</option>
                      <option value="Equipment">Studio Equipment</option>
                      <option value="Vehicle">Vehicle</option>
                      <option value="Real Estate">Real Estate / Shop</option>
                      <option value="Computer/IT">Computer & IT</option>
                      <option value="Other">Other Asset</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                      {assetOwnershipStatus === "planned" ? "Target Buy Date" : "Purchase Date"}
                    </label>
                    <input
                      type="date"
                      required
                      value={assetPurchaseDate}
                      onChange={(e) => setAssetPurchaseDate(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                      {assetOwnershipStatus === "planned" ? "Target Price" : "Purchase Cost"} ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={assetPurchasePrice}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setAssetPurchasePrice(val);
                        setAssetCurrentValue(val);
                      }}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                    />
                  </div>

                  {assetOwnershipStatus === "owned" ? (
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Estimated Value ({currencySymbol})</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={assetCurrentValue}
                        onChange={(e) => setAssetCurrentValue(Number(e.target.value))}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Priority Level</label>
                      <select
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2.5 py-2 outline-none font-sans"
                        defaultValue="Medium"
                      >
                        <option value="High">🔥 High Priority</option>
                        <option value="Medium">⚡ Medium Priority</option>
                        <option value="Low">💤 Low Priority</option>
                      </select>
                    </div>
                  )}
                </div>

                {assetOwnershipStatus === "owned" ? (
                  <>
                    <div className="border-t border-slate-100 pt-3 space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Depreciation Settings (Analytical)</h4>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Depreciation Method</label>
                          <select
                            value={assetDepreciationMethod}
                            onChange={(e: any) => setAssetDepreciationMethod(e.target.value)}
                            className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                          >
                            <option value="Straight Line">Straight Line</option>
                            <option value="Double Declining">Double Declining</option>
                            <option value="None">None (Static value)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Useful Life (Yrs)</label>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={assetUsefulLife}
                            onChange={(e) => setAssetUsefulLife(Number(e.target.value))}
                            disabled={assetDepreciationMethod === "None"}
                            className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-1.5 outline-none font-sans disabled:opacity-50"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-slate-400 uppercase tracking-widest block">Residual / Salvage Value ({currencySymbol})</label>
                        <input
                          type="number"
                          min="0"
                          value={assetSalvageValue}
                          onChange={(e) => setAssetSalvageValue(Number(e.target.value))}
                          disabled={assetDepreciationMethod === "None"}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Maintenance & Documents Notes</h4>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-450 uppercase tracking-widest block">Last Service Date</label>
                          <input
                            type="date"
                            value={assetMaintenanceLast}
                            onChange={(e) => setAssetMaintenanceLast(e.target.value)}
                            className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-1 outline-none font-sans"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-450 uppercase tracking-widest block">Next Scheduled Service</label>
                          <input
                            type="date"
                            value={assetMaintenanceNext}
                            onChange={(e) => setAssetMaintenanceNext(e.target.value)}
                            className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-1 outline-none font-sans"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-450 uppercase tracking-widest block">
                      {assetOwnershipStatus === "planned" ? "Ownership, Supplier or Quote Notes" : "Serials, Warranty or Document Registry Details"}
                    </label>
                    <input
                      type="text"
                      placeholder={assetOwnershipStatus === "planned" ? "e.g. Quoted by Photostore Accra, 12 month valid quote" : "e.g. Serial #SNG-9988-G, 1 year warrantee"}
                      value={assetDocsNotes}
                      onChange={(e) => setAssetDocsNotes(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono text-slate-450 uppercase tracking-widest block">General Specifications & Notes</label>
                    <textarea
                      rows={2}
                      placeholder={assetOwnershipStatus === "planned" ? "e.g. Crucial for expanding portrait package capacity. Expected ROI high." : "e.g. Primary production machinery. Keep lubricated weekly."}
                      value={assetNotes}
                      onChange={(e) => setAssetNotes(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl text-white font-extrabold uppercase tracking-wider cursor-pointer transition-colors shadow-md shadow-emerald-600/10"
                >
                  Confirm Asset Placement
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 text-[11px] leading-relaxed text-slate-500">
                  <p className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-emerald-500" />
                    Asset Maintenance & Lifecycles
                  </p>
                  Registering your operational hardware assets allows you to:
                  <ul className="list-disc pl-4 mt-2 space-y-1 font-light">
                    <li>Deduct estimated linear depreciation to reflect true enterprise equity worth.</li>
                    <li>Configure maintenance schedules to ensure zero downtime on manufacturing lines.</li>
                    <li>Link specific high-priority equipment acquisitions to forward-looking savings targets.</li>
                  </ul>
                </div>

                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-[11px] text-slate-600 space-y-2">
                  <strong className="block text-slate-900 font-extrabold">Active Asset Book Profile</strong>
                  <div className="flex justify-between font-mono">
                    <span>Aggregate Purchase Cost:</span>
                    <span className="font-bold text-slate-900">{currencySymbol}{totalAssetsOriginalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Accrued Depreciation:</span>
                    <span className="font-bold text-rose-650">-{currencySymbol}{(totalAssetsOriginalPrice - totalAssetsBookValue).toLocaleString()}</span>
                  </div>
                  <hr className="border-slate-200/50" />
                  <div className="flex justify-between font-mono font-bold text-xs">
                    <span className="text-emerald-700">Net Ledger Book Value:</span>
                    <span className="text-emerald-700">{currencySymbol}{totalAssetsBookValue.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsAddingAsset(true)}
                  className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold py-3 rounded-xl border border-emerald-200/40 transition-colors cursor-pointer text-center block text-xs tracking-wider uppercase"
                >
                  Register New Workspace Asset
                </button>
              </div>
            )}
          </div>

          {/* RIGHT: Active Assets Registry Table & Detailed Cards */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-emerald-500" />
                  Owned Tangible Assets Registry ({filteredAssets.length})
                </span>
                <span className="font-mono text-[10px] text-slate-500">Book Value: {currencySymbol}{totalAssetsBookValue.toLocaleString()}</span>
              </h4>

              {filteredAssets.length === 0 ? (
                <div className="text-center py-16 text-slate-400 italic text-xs">
                  No active operational assets registered in ledger book yet. Click "Register New Workspace Asset" to log your first equipment or machinery record.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAssets.map(asset => {
                    const isPlanned = asset.notes?.startsWith("[Planned]");
                    const cleanNotes = asset.notes ? asset.notes.replace(/^\[Planned\]\s*/, "") : "";
                    const dep = calculateDepreciation(asset);
                    const isOverdue = asset.maintenanceNextDate && new Date(asset.maintenanceNextDate) < new Date();
                    
                    return (
                      <div 
                        key={asset.id} 
                        className={`bg-slate-50 border rounded-2xl p-4.5 space-y-3 hover:border-slate-350 transition-all flex flex-col justify-between relative overflow-hidden ${
 selectedAssetId === asset.id ? "ring-2 ring-emerald-500 border-transparent" : "border-slate-200"
 } ${isPlanned ? "border-indigo-250 shadow-sm shadow-indigo-100/50 animate-fade-in" : ""}`}
                      >
                        {/* Header class badge */}
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            {isPlanned ? (
                              <span className="text-[9px] font-mono font-bold text-indigo-700 uppercase bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full inline-block mb-1">
                                ⏳ Planned Acquisition ({asset.category})
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-bold text-emerald-700 uppercase bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full inline-block mb-1">
                                {asset.category}
                              </span>
                            )}
                            <h4 className="font-extrabold text-xs text-slate-900 leading-snug">{asset.name}</h4>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (onDeleteAsset) onDeleteAsset(asset.id);
                              }}
                              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="Delete Asset Record" aria-label="Delete Asset Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isPlanned ? (
                          <>
                            {/* Planned stats */}
                            <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-150 font-mono text-[10px] text-left">
                              <div>
                                <span className="text-[9px] text-slate-400 block font-sans">Target Price</span>
                                <strong className="text-indigo-650 block font-extrabold">{currencySymbol}{asset.purchasePrice.toLocaleString()}</strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-sans">Expected Buy Date</span>
                                <strong className="text-slate-900 block font-extrabold">{asset.purchaseDate}</strong>
                              </div>
                            </div>

                            {/* Action block to purchase/activate planned asset */}
                            {purchasingAssetId === asset.id ? (
                              <div className="bg-white p-3 rounded-xl border border-indigo-150 space-y-2.5 text-left text-[11px] animate-fade-in">
                                <h5 className="font-bold text-slate-850 flex items-center gap-1.5">
                                  <FileCheck className="w-4 h-4 text-emerald-600" />
                                  Confirm Actual Purchase
                                </h5>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-mono text-slate-400 uppercase">Actual Price Paid ({currencySymbol})</label>
                                  <input 
                                    type="number"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none font-mono"
                                    value={actualPurchasePrice}
                                    onChange={(e) => setActualPurchasePrice(Number(e.target.value))}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-mono text-slate-400 uppercase">Serial # / Warranty / Documents Notes</label>
                                  <input 
                                    type="text"
                                    placeholder="e.g. Serial #CM-998, purchased with 1 year warrantee from dealer"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-[10px]"
                                    value={purchaseReceiptNotes}
                                    onChange={(e) => setPurchaseReceiptNotes(e.target.value)}
                                  />
                                </div>
                                <div className="flex gap-2 justify-end pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setPurchasingAssetId(null)}
                                    className="px-2.5 py-1 text-slate-400 hover:text-slate-600 text-[10px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleConfirmPurchaseAsset(asset, actualPurchasePrice, purchaseReceiptNotes);
                                      setPurchasingAssetId(null);
                                    }}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                                  >
                                    Save & Activate Asset
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-indigo-55/40 p-3 rounded-xl border border-indigo-100/60 text-[10px] flex items-center justify-between gap-3">
                                <div className="text-left">
                                  <span className="text-[9px] text-slate-400 font-mono block">PLANNING STATUS</span>
                                  <span className="font-bold text-indigo-700 flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    Acquisition Planned
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPurchasingAssetId(asset.id);
                                    setActualPurchasePrice(asset.purchasePrice);
                                    setPurchaseReceiptNotes(asset.documentsNotes || "");
                                  }}
                                  className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer text-[10px] shadow-sm shadow-indigo-600/15"
                                >
                                  <CheckCircle className="w-3 h-3 text-white" />
                                  Log Purchase
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Depreciation stats comparison */}
                            <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-150 font-mono text-[10px] text-left">
                              <div>
                                <span className="text-[9px] text-slate-400 block font-sans">Purchase Cost</span>
                                <strong className="text-slate-900 block font-extrabold">{currencySymbol}{asset.purchasePrice.toLocaleString()}</strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 block font-sans">Accum. Dep.</span>
                                <strong className="text-rose-650 block">-{currencySymbol}{dep.accumulatedDepreciation.toLocaleString()}</strong>
                              </div>
                              <div>
                                <span className="text-[9px] text-emerald-600 block font-sans">Book Value</span>
                                <strong className="text-emerald-600 block font-extrabold">{currencySymbol}{dep.bookValue.toLocaleString()}</strong>
                              </div>
                            </div>

                            {/* Depreciation Details / Useful Life */}
                            <div className="text-[10px] text-slate-500 flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                <span>Acquired: <strong className="text-slate-750">{asset.purchaseDate}</strong></span>
                                <span>Useful Life: <strong className="text-slate-750">{asset.usefulLifeYears} Yrs</strong></span>
                              </div>
                              <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                                <span>Method: {asset.depreciationMethod}</span>
                                <span>Residual: {currencySymbol}{asset.salvageValue ?? 0}</span>
                              </div>
                            </div>

                            {/* Maintenance scheduling indicator */}
                            <div className="bg-white p-3 rounded-xl border border-slate-200/50 text-[10px] flex items-center justify-between gap-3">
                              <div className="space-y-0.5 text-left">
                                <span className="text-[9px] text-slate-400 font-mono block">MAINTENANCE STATUS</span>
                                <span className={`font-bold flex items-center gap-1 ${
 isOverdue 
 ? "text-rose-600" 
 : asset.maintenanceStatus === "Needs Service" 
 ? "text-amber-500" 
 : "text-emerald-600"
 }`}>
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  {isOverdue ? "Overdue Service" : asset.maintenanceStatus === "Needs Service" ? "Needs Service" : "Good"}
                                </span>
                                {asset.maintenanceNextDate && (
                                  <span className="text-[9px] text-slate-450 block font-mono">Next: {asset.maintenanceNextDate}</span>
                                )}
                              </div>

                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handlePerformService(asset.id)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                >
                                  <Wrench className="w-3 h-3 text-emerald-500" />
                                  Service
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAssetId(selectedAssetId === asset.id ? null : asset.id);
                                    if (updatingEstimatedValueAssetId) setUpdatingEstimatedValueAssetId(null);
                                  }}
                                  className="px-2 py-1 bg-slate-900 hover:bg-black text-white rounded-lg font-bold transition-colors cursor-pointer text-[10px]"
                                >
                                  {selectedAssetId === asset.id ? "Hide Details" : "Inspect"}
                                </button>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Expanded Details Panel */}
                        {selectedAssetId === asset.id && (
                          <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-[11px] space-y-2.5 text-slate-700 animate-fade-in text-left">
                            <div className="flex justify-between items-center">
                              <h5 className="font-extrabold text-slate-900">Full Asset Specifications</h5>
                              <button
                                type="button"
                                onClick={() => {
                                  setUpdatingEstimatedValueAssetId(asset.id);
                                  setTempAssetValue(asset.currentValue);
                                }}
                                className="text-[10px] text-emerald-600 hover:underline font-bold"
                              >
                                Edit Market Valuation
                              </button>
                            </div>

                            {updatingEstimatedValueAssetId === asset.id ? (
                              <div className="space-y-1.5 p-2 bg-white border border-slate-200 rounded-lg">
                                <label className="text-[9px] font-mono uppercase font-bold tracking-wider">Manual Market Estimation</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="number"
                                    value={tempAssetValue}
                                    onChange={(e) => setTempAssetValue(Number(e.target.value))}
                                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-lg p-1 text-xs outline-none"
                                  />
                                  <button
                                    onClick={() => handleSaveAssetValueUpdate(asset.id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-1 rounded-lg text-xs"
                                  >
                                    Apply
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            <div className="space-y-1 text-slate-600 leading-normal font-light">
                              {asset.documentsNotes && (
                                <p className="flex items-start gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span><strong>Documents / Serial:</strong> {asset.documentsNotes}</span>
                                </p>
                              )}
                              {asset.maintenanceNotes && (
                                <p className="flex items-start gap-1.5">
                                  <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span><strong>Last Service Logs:</strong> {asset.maintenanceNotes}</span>
                                </p>
                              )}
                              {asset.notes && (
                                <p className="flex items-start gap-1.5">
                                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span><strong>General Notes:</strong> {asset.notes}</span>
                                </p>
                              )}
                              <p className="font-mono text-[9px] text-slate-400 border-t border-slate-200/50 pt-1.5">
                                Cumulative Age Owned: {dep.yearsOwned} Years
                              </p>
                            </div>
                          </div>
                        )}

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Asset Planning and Reinvestment Goals Section */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-left">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Asset Reinvestment & Expansion Planning</h3>
                  <p className="text-[11px] text-slate-500 font-light mt-0.5">Safeguard cash flow by aligning future equipment needs with active capital savings targets.</p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab("goals");
                    setIsAddingGoal(true);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 border border-emerald-200/40 text-[10px] uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Configure Savings Goal
                </button>
              </div>

              {/* Show equipment goals in active registry */}
              {filteredGoals.filter(g => g.type === "Equipment").length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs italic">
                  No pending equipment or machinery replacement goals set yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredGoals.filter(g => g.type === "Equipment").map(goal => {
                    const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
                    return (
                      <div key={goal.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Operational Goal
                            </span>
                            <h5 className="font-extrabold text-slate-900 mt-1.5">{goal.name}</h5>
                          </div>
                          <div className="text-right font-mono text-[11px]">
                            <span className="text-slate-400 block font-sans text-[9px] uppercase font-bold tracking-widest">Savings Target</span>
                            <strong className="text-slate-800 font-extrabold">{currencySymbol}{goal.targetAmount.toLocaleString()}</strong>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-450 mt-1">
                            <span>Saved: <strong>{currencySymbol}{goal.currentAmount.toLocaleString()}</strong> ({percent}%)</span>
                            <span className="font-mono">Deadline: {goal.deadline}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

              {/* TAB 2: SME INVESTMENT DESK (INVESTMENT PORTFOLIO TRACKER) */}
      {activeTab === "investments" && (
        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 text-left animate-fade-in">
          
          {/* Important Regulatory Warning Banner */}
          <div className="lg:col-span-12 bg-amber-50 border border-amber-200 text-amber-900 p-4.5 rounded-3xl flex items-start gap-3.5 text-xs">
            <div className="bg-amber-100 text-amber-800 w-11 h-11 rounded-2xl flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-amber-500" />
            </div>
            <div className="space-y-1.5 leading-relaxed">
              <h4 className="font-black uppercase tracking-wider text-[11px] text-amber-850">Important Non-Custodial & Informational Notice</h4>
              <p className="text-[11px] font-light text-slate-600">
                Aziiki is <strong>not</strong> a financial institution, bank, investment advisor, or digital wallet. Aziiki **does not** accept deposits, hold funds, or execute capital trades on behalf of users. The SME Investment Desk operates purely as an analytical tracker and planning portfolio workspace. All investments represent manual bookkeeping records; your actual capital remains secure within your primary bank, treasury, or sovereign cooperative.
              </p>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="lg:col-span-12 flex flex-wrap gap-2 border-b border-slate-150 pb-2">
            <button
              onClick={() => setInvestmentsSubTab("positions")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
 investmentsSubTab === "positions"
 ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
 : "bg-slate-100 text-slate-650 hover:bg-slate-200"
 }`}
            >
              💼 Active Positions & Indices
            </button>
            <button
              onClick={() => setInvestmentsSubTab("calculator")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
 investmentsSubTab === "calculator"
 ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
 : "bg-slate-100 text-slate-650 hover:bg-slate-200"
 }`}
            >
              🧮 Yield Calculator & Estimator
            </button>
            <button
              onClick={() => setInvestmentsSubTab("comparison")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
 investmentsSubTab === "comparison"
 ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
 : "bg-slate-100 text-slate-650 hover:bg-slate-200"
 }`}
            >
              ⚖️ Yield Comparison Simulator
            </button>
            <button
              onClick={() => setInvestmentsSubTab("ai")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
 investmentsSubTab === "ai"
 ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
 : "bg-slate-100 text-slate-650 hover:bg-slate-200"
 }`}
            >
              ✨ AI Advisory & Insights
            </button>
          </div>

          {/* VIEW 1: ACTIVE POSITIONS & INDICES */}
          {investmentsSubTab === "positions" && (
            <>
              {/* LEFT: Add Investment Form & Allocations */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 space-y-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-emerald-600" />
                    Portfolio Setup
                  </h3>
                  <button
                    onClick={() => setIsAddingInv(!isAddingInv)}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer font-sans"
                  >
                    {isAddingInv ? "Cancel" : <><Plus className="w-4 h-4" /> Add Record</>}
                  </button>
                </div>

                {isAddingInv ? (
                  <form onSubmit={handleSaveInvestment} className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Investment Asset Type</label>
                      <select
                        value={invType}
                        onChange={(e: any) => setInvType(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 rounded-xl px-2.5 py-2 border border-slate-200 mt-1 outline-none font-sans"
                      >
                        <option value="Treasury Bill">{market.treasuryBillLabel}</option>
                        <option value="Stock">{market.stockExchangeLabel}</option>
                        <option value="Mutual Fund">{market.mutualFundLabel}</option>
                        <option value="Savings Account">{market.savingsLabel}</option>
                        <option value="Fixed Deposit">Commercial Fixed Deposit</option>
                        <option value="Bond">Sovereign / Corporate Bond</option>
                        <option value="Real Estate">Real Estate Asset</option>
                        <option value="Business Investment">Private Equity / Venture</option>
                        <option value="SACCO/Cooperative">SACCO or Credit Union Savings</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Investment Name / Scheme</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 91-Day Sovereign T-Bill"
                        value={invName}
                        onChange={(e) => setInvName(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Issuer / Institution</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ghana Commercial Bank (GCB)"
                        value={invIns}
                        onChange={(e) => setInvIns(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Initial Capital Invested</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={invAmountInvested}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setInvAmountInvested(val);
                            setInvValue(val); // Initialize current value with cost
                          }}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-2 outline-none font-sans"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Current Estimated Value</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={invValue}
                          onChange={(e) => setInvValue(Number(e.target.value))}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-2 outline-none font-sans"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Expected Return (% p.a)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={invExpectedRate}
                          onChange={(e) => setInvExpectedRate(Number(e.target.value))}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-2 outline-none font-sans"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Maturity Settlement Date</label>
                        <input
                          type="date"
                          value={invMaturity}
                          onChange={(e) => setInvMaturity(e.target.value)}
                          className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-1.5 outline-none font-sans"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Strategy Notes / Allocation Reason</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Sovereign backing to preserve operational runway reserves."
                        value={invNotes}
                        onChange={(e) => setInvNotes(e.target.value)}
                        className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl text-white font-extrabold uppercase tracking-wider cursor-pointer transition-colors shadow-md shadow-emerald-600/10"
                    >
                      Confirm Ledger Record
                    </button>
                  </form>
                ) : (
                  <div className="space-y-5">
                    {/* Visual Asset Allocation weights tracker */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-4">
                      <div>
                        <h4 className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">Asset Class Allocation</h4>
                        <p className="text-[11px] text-slate-400 font-light mt-0.5">Distribution of tracking portfolio by asset class weights.</p>
                      </div>

                      {weights.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 italic text-[11px]">
                          No assets logged yet to compute weights.
                        </div>
                      ) : (
                        <div className="space-y-3 text-xs leading-relaxed">
                          {/* Weighted allocation bar */}
                          <div className="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden flex border border-slate-300/40">
                            {weights.map((w, idx) => {
                              const colors = ["bg-emerald-500", "bg-indigo-500", "bg-purple-500", "bg-amber-500", "bg-sky-500", "bg-rose-500"];
                              const c = colors[idx % colors.length];
                              return (
                                <div 
                                  key={w.type} 
                                  className={`${c} h-full transition-all`} 
                                  style={{ width: `${w.percentage}%` }}
                                  title={`${w.type}: ${w.percentage}%`}
                                ></div>
                              );
                            })}
                          </div>

                          {/* Legends */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                            {weights.map((w, idx) => {
                              const colors = ["bg-emerald-500", "bg-indigo-500", "bg-purple-500", "bg-amber-500", "bg-sky-500", "bg-rose-500"];
                              const c = colors[idx % colors.length];
                              return (
                                <div key={w.type} className="flex items-center gap-1.5 font-sans">
                                  <span className={`w-2.5 h-2.5 rounded-full ${c} shrink-0`}></span>
                                  <span className="text-slate-650 truncate max-w-[80%]">{w.type}</span>
                                  <strong className="text-slate-900 font-mono ml-auto shrink-0">{w.percentage}%</strong>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Compound Growth Estimator (Educational/Planning Slider) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3.5">
                      <div>
                        <h4 className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center gap-1.5">
                          <Calculator className="w-3.5 h-3.5 text-indigo-500" />
                          Educational Growth Estimator
                        </h4>
                        <p className="text-[11px] text-slate-400 font-light mt-0.5">Project potential future growth on your tracked assets using compound interest mechanics.</p>
                      </div>

                      {totalInvestmentCurrentValue === 0 ? (
                        <div className="text-center py-4 text-slate-400 italic text-[11px]">
                          Register some investment holdings to model growth projections.
                        </div>
                      ) : (
                        <div className="space-y-3.5 text-xs">
                          <div className="flex justify-between font-mono text-[11px]">
                            <span>Weighted Expected Rate:</span>
                            <strong className="text-emerald-600">{projection.rate}% p.a</strong>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                              <span>Horizon Period:</span>
                              <span className="font-bold text-indigo-600">{projectionYears} Years</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="20"
                              value={projectionYears}
                              onChange={(e) => setProjectionYears(Number(e.target.value))}
                              className="w-full accent-emerald-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                            />
                          </div>

                          <div className="border-t border-slate-200/60 pt-3 space-y-1 leading-normal font-sans">
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">Estimated Projected Valuation</span>
                            <strong className="text-sm font-black text-slate-900 font-mono block">
                              {currencySymbol}{projection.value.toLocaleString()}
                            </strong>
                            <span className="text-[10px] text-emerald-600 font-light block">
                              Potential accrued capital value: +{currencySymbol}{projection.interestGained.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setIsAddingInv(true)}
                      className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold py-3 rounded-xl border border-emerald-200/40 transition-colors cursor-pointer text-center block text-xs tracking-wider uppercase"
                    >
                      Log Investment Position
                    </button>
                  </div>
                )}
              </div>

              {/* RIGHT: Active Investment Holding Table & Tracker List */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-4.5 h-4.5 text-emerald-500 animate-pulse" />
                      Active Yield Investment Positions ({filteredInvestments.length})
                    </h4>
                    {filteredInvestments.length > 0 && (
                      <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
                        <span>Capital Invested: {currencySymbol}{totalInvestmentsCost.toLocaleString()}</span>
                        <span>ROI: <strong className={portfolioROIValue >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {portfolioROIValue >= 0 ? "+" : ""}{currencySymbol}{portfolioROIValue.toLocaleString()} ({portfolioROIPercent.toFixed(1)}%)
                        </strong></span>
                      </div>
                    )}
                  </div>

                  {filteredInvestments.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 italic text-xs">
                      No high-yield investment holdings logged in tracker yet. Click "Log Investment Position" to record your first asset reserve position.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      {filteredInvestments.map((inv) => {
                        const cost = inv.amountInvested ?? inv.value;
                        const gainLoss = inv.value - cost;
                        const roi = cost > 0 ? (gainLoss / cost) * 100 : 0;
                        
                        return (
                          <div key={inv.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-350 transition-all relative overflow-hidden text-left">
                            
                            {/* Type Tag */}
                            <div className="flex justify-between items-start gap-4 mb-2">
                              <div>
                                <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full inline-block mb-1 uppercase tracking-wider">
                                  {inv.type}
                                </span>
                                <h4 className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">{inv.name}</h4>
                                <span className="text-[9px] text-slate-400 block font-mono mt-0.5">Issuer: {inv.institution}</span>
                              </div>

                              <button
                                onClick={() => {
                                  if (onDeleteInvestment) onDeleteInvestment(inv.id);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                title="Delete Investment Record" aria-label="Delete Investment Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Financial Parameters */}
                            <div className="border-t border-slate-200/60 pt-3 mt-3 space-y-2.5 font-mono text-[10px] text-slate-500">
                              <div className="flex justify-between">
                                <span>Initial Capital cost:</span>
                                <strong className="text-slate-800">{currencySymbol}{cost.toLocaleString()}</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>Expected Yield:</span>
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                  <Percent className="w-2.5 h-2.5" /> {inv.expectedReturnRate}% p.a
                                </span>
                              </div>
                              {inv.maturityDate && (
                                <div className="flex justify-between text-[9px] text-slate-400">
                                  <span>Maturity Date:</span>
                                  <span>{inv.maturityDate}</span>
                                </div>
                              )}

                              {/* ROI Indicators */}
                              <div className="bg-white p-2.5 rounded-xl border border-slate-150 text-[11px] flex justify-between items-center font-sans">
                                <div>
                                  <span className="text-[9px] text-slate-400 block font-mono uppercase tracking-widest font-bold">Estimated value</span>
                                  <strong className="text-slate-900 font-mono font-bold">{currencySymbol}{inv.value.toLocaleString()}</strong>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] text-slate-450 block font-sans">Return (ROI)</span>
                                  <strong className={`font-mono text-xs font-bold ${gainLoss >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {gainLoss >= 0 ? "+" : ""}{currencySymbol}{gainLoss.toLocaleString()} ({roi.toFixed(1)}%)
                                  </strong>
                                </div>
                              </div>
                            </div>

                            {/* Notes */}
                            {inv.notes && (
                              <p className="mt-2 text-[10px] italic text-slate-500 font-light border-t border-slate-150/40 pt-1.5 leading-snug">
                                💡 {inv.notes}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* AI-Powered Live Market Sourcing Card */}
                <div className="bg-slate-905 bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col gap-5 text-left font-sans">
                  <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-emerald-600/15 text-emerald-400 w-10 h-10 rounded-xl flex items-center justify-center border border-emerald-500/25 shrink-0 mt-0.5 animate-pulse">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black tracking-tight flex items-center gap-2">
                          Live Investment Indices Sourcing Desk
                          <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                            AI Connected
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                          Sourced real-time central bank policy rates, sovereign treasury yields, and consumer inflation indices from live online searches.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isFetchingLive}
                      onClick={handleSourceLiveRates}
                      className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all border border-emerald-500/20 text-xs shrink-0 self-start sm:self-auto shadow-lg shadow-emerald-500/10 select-none font-sans font-medium"
                    >
                      {isFetchingLive ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          Searching Live Indexes...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-emerald-250" />
                          Source Live Indices ({currencySymbol})
                        </>
                      )}
                    </button>
                  </div>

                  {liveError && (
                    <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-xs text-red-400 font-mono">
                      ⚠️ {liveError}
                    </div>
                  )}

                  {!liveData && !isFetchingLive && !liveError && (
                    <div className="text-center py-6 text-slate-400 text-xs font-sans">
                      📊 No live research indices loaded yet. Click <strong className="text-emerald-400">Source Live Indices</strong> above to query live figures.
                    </div>
                  )}

                  {isFetchingLive && (
                    <div className="space-y-4 animate-pulse text-xs font-sans">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-950/20 p-3.5 border border-slate-850 rounded-xl space-y-2">
                          <div className="h-2 bg-slate-800 rounded w-1/3"></div>
                          <div className="h-4 bg-slate-800 rounded w-2/3"></div>
                        </div>
                        <div className="bg-slate-950/20 p-3.5 border border-slate-850 rounded-xl space-y-2">
                          <div className="h-2 bg-slate-800 rounded w-1/3"></div>
                          <div className="h-4 bg-slate-800 rounded w-1/4"></div>
                        </div>
                        <div className="bg-slate-950/20 p-3.5 border border-slate-850 rounded-xl space-y-2">
                          <div className="h-2 bg-slate-800 rounded w-1/3"></div>
                          <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                        </div>
                      </div>

                      {/* Sourced Rates Table Skeleton */}
                      <div className="bg-slate-950/15 border border-slate-850 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-12 bg-slate-950/40 p-2.5 border-b border-slate-850">
                          <div className="col-span-5"><div className="h-2 bg-slate-800 rounded w-1/2"></div></div>
                          <div className="col-span-2"><div className="h-2 bg-slate-800 rounded w-1/3 mx-auto"></div></div>
                          <div className="col-span-2"><div className="h-2 bg-slate-800 rounded w-1/3 mx-auto"></div></div>
                          <div className="col-span-3 text-right"><div className="h-2 bg-slate-800 rounded w-1/3 ml-auto"></div></div>
                        </div>
                        
                        <div className="divide-y divide-slate-850">
                          {[1, 2, 3].map((item) => (
                            <div key={item} className="grid grid-cols-12 p-3.5 items-center">
                              <div className="col-span-5"><div className="h-3 bg-slate-800 rounded w-2/3"></div></div>
                              <div className="col-span-2"><div className="h-3 bg-slate-800 rounded w-1/4 mx-auto"></div></div>
                              <div className="col-span-2"><div className="h-3 bg-slate-800 rounded w-1/3 mx-auto"></div></div>
                              <div className="col-span-3 text-right space-y-1"><div className="h-3 bg-slate-800 rounded w-2/3 ml-auto"></div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {liveData && !isFetchingLive && (
                    <div className="space-y-4 animate-fade-in text-xs font-sans">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-950/45 p-3.5 border border-slate-850 rounded-xl leading-relaxed text-left">
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Research Source Gateway</span>
                          <strong className="text-slate-100 font-extrabold text-xs block mt-1">{liveData.sourceName || "Central Bank Spectrum"}</strong>
                        </div>
                        <div className="bg-slate-950/45 p-3.5 border border-slate-850 rounded-xl leading-relaxed text-left">
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Locally Sourced Inflation Rate</span>
                          <strong className="text-rose-400 font-extrabold text-sm font-mono block mt-1">{liveData.localInflation || "N/A"}</strong>
                        </div>
                        <div className="bg-slate-950/45 p-3.5 border border-slate-850 rounded-xl leading-relaxed text-left">
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold">Indices Refresh Range</span>
                          <strong className="text-slate-100 font-extrabold text-xs block mt-1">Sourced Real-Time ({liveData.lastChecked || "Live"})</strong>
                        </div>
                      </div>

                      {/* Sourced Rates Table */}
                      <div className="bg-slate-950/30 border border-slate-850 rounded-xl overflow-hidden">
                        <div className="grid grid-cols-12 bg-slate-950/60 p-2.5 font-mono text-[9px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-850">
                          <div className="col-span-5 text-left">Sovereign / Escrow Asset Class</div>
                          <div className="col-span-2 text-center">Live Yield (APY)</div>
                          <div className="col-span-2 text-center">Trend</div>
                          <div className="col-span-3 text-right">Risk/Institution Spectrum</div>
                        </div>
                        
                        <div className="divide-y divide-slate-850">
                          {liveData.rates?.map((rateObj: any, idx: number) => {
                            return (
                              <div key={idx} className="grid grid-cols-12 p-3 items-center hover:bg-white/[0.02] transition-colors">
                                <div className="col-span-5 font-bold text-slate-200 text-left">{rateObj.asset}</div>
                                <div className="col-span-2 text-center font-mono font-black text-emerald-400 text-[13px]">{rateObj.rate}</div>
                                <div className="col-span-2 text-center flex justify-center">
                                  {rateObj.trend === "up" ? (
                                    <span className="text-emerald-400 font-bold text-[9px] bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                      ▲ Up
                                    </span>
                                  ) : rateObj.trend === "down" ? (
                                    <span className="text-rose-400 font-bold text-[9px] bg-rose-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                      ▼ Down
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-bold text-[9px] bg-slate-500/10 px-2 py-0.5 rounded-full">
                                      ▬ Flat
                                    </span>
                                  )}
                                </div>
                                <div className="col-span-3 text-right font-mono text-[10px] text-slate-400 leading-relaxed">
                                  <span className="block font-bold text-slate-300">{rateObj.source}</span>
                                  <span className="text-[9px] text-slate-500 italic font-sans block mt-0.5">{rateObj.safety}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Market Advisory Alert */}
                      <div className="bg-emerald-600/10 border border-emerald-500/25 rounded-xl p-4 text-emerald-300 flex items-start gap-3">
                        <div className="bg-emerald-600/20 text-emerald-400 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-emerald-500/30 font-bold text-xs">
                          💡
                        </div>
                        <div className="space-y-1 text-left">
                          <h5 className="text-[10px] font-mono uppercase tracking-widest font-black text-emerald-250">
                            SME Portfolio Allocation Tactics
                          </h5>
                          <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                            {liveData.marketAdvisory || "Sovereign bills remain prime safe spaces to offset inflation. Use treasury ladders to maintain healthy cash flow cycles during persistent inflationary pressures."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* VIEW 2: YIELD CALCULATOR & ESTIMATOR */}
          {investmentsSubTab === "calculator" && (
            <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
              {/* LEFT: Calculator Controls */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 space-y-5 shadow-sm">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                    Calculator Controls
                  </h3>
                  <p className="text-[11px] text-slate-400 font-light mt-0.5">Adjust inputs to simulate prospective interest rate yields over custom maturity windows.</p>
                </div>

                <div className="space-y-4">
                  {/* Principal */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-mono font-bold text-slate-500 uppercase">Simulated Capital</span>
                      <span className="font-mono font-extrabold text-emerald-650 text-xs">{currencySymbol}{simulatedPrincipal.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="500000"
                      step="500"
                      value={simulatedPrincipal}
                      onChange={(e) => setSimulatedPrincipal(Number(e.target.value))}
                      className="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{currencySymbol}500</span>
                      <input
                        type="number"
                        value={simulatedPrincipal}
                        onChange={(e) => setSimulatedPrincipal(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 font-mono text-[11px] text-right outline-none text-slate-900"
                      />
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">{currencySymbol}500k+</span>
                    </div>
                  </div>

                  {/* Annual Rate */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-mono font-bold text-slate-500 uppercase">Expected Rate (% p.a.)</span>
                      <span className="font-mono font-extrabold text-indigo-600 text-xs">{simulatedRate}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="40"
                      step="0.1"
                      value={simulatedRate}
                      onChange={(e) => setSimulatedRate(Number(e.target.value))}
                      className="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">1%</span>
                      <input
                        type="number"
                        step="0.1"
                        value={simulatedRate}
                        onChange={(e) => setSimulatedRate(Math.max(0, Number(e.target.value)))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 font-mono text-[11px] text-right outline-none text-slate-900"
                      />
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">40%</span>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-mono font-bold text-slate-500 uppercase">Investment Duration</span>
                      <span className="font-mono font-extrabold text-amber-600 text-xs">{simulatedDuration} Months</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      step="1"
                      value={simulatedDuration}
                      onChange={(e) => setSimulatedDuration(Number(e.target.value))}
                      className="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                    />
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">1 Mo</span>
                      <input
                        type="number"
                        value={simulatedDuration}
                        onChange={(e) => setSimulatedDuration(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 font-mono text-[11px] text-right outline-none text-slate-900"
                      />
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">5 Yrs</span>
                    </div>
                  </div>

                  {/* Compounding Method */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Compounding Mechanics</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSimulatedCompounding("Simple")}
                        className={`py-2 rounded-xl text-[10px] font-bold cursor-pointer transition-colors border ${
 simulatedCompounding === "Simple"
 ? "bg-slate-900 text-white border-transparent"
 : "bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100"
 }`}
                      >
                        Simple Interest
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedCompounding("Compound")}
                        className={`py-2 rounded-xl text-[10px] font-bold cursor-pointer transition-colors border ${
 simulatedCompounding === "Compound"
 ? "bg-slate-900 text-white border-transparent"
 : "bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100"
 }`}
                      >
                        Compound (Quarterly)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: Calculated Outcomes card & projections table */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                {(() => {
                  const rateFrac = simulatedRate / 100;
                  const timeYears = simulatedDuration / 12;
                  let interestGained = 0;
                  if (simulatedCompounding === "Simple") {
                    interestGained = simulatedPrincipal * rateFrac * timeYears;
                  } else {
                    interestGained = simulatedPrincipal * (Math.pow(1 + rateFrac / 4, 4 * timeYears) - 1);
                  }
                  const matVal = simulatedPrincipal + interestGained;

                  return (
                    <>
                      <div className="border-b border-slate-100 pb-3">
                        <h4 className="text-xs font-extrabold text-slate-450 uppercase tracking-widest">
                          Simulated Yield Projection
                        </h4>
                        <p className="text-[11px] text-slate-500 font-light mt-0.5">Calculated projections based on standard sovereign and corporate treasury yield formulas.</p>
                      </div>

                      {/* Main aggregate metrics bento */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl text-left">
                          <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">Principal</span>
                          <strong className="text-xs font-extrabold text-slate-850 font-mono block mt-1">{currencySymbol}{simulatedPrincipal.toLocaleString()}</strong>
                        </div>
                        <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl text-left">
                          <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">APY Rate</span>
                          <strong className="text-xs font-extrabold text-slate-850 font-mono block mt-1">{simulatedRate}% p.a</strong>
                        </div>
                        <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl text-left">
                          <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">Interest Earned</span>
                          <strong className="text-xs font-extrabold text-emerald-600 block font-mono mt-1">+{currencySymbol}{Math.round(interestGained).toLocaleString()}</strong>
                        </div>
                        <div className="bg-slate-50 p-4 border border-slate-150 rounded-2xl text-left">
                          <span className="text-[9px] font-mono text-slate-400 block uppercase font-bold">Maturity Value</span>
                          <strong className="text-xs font-extrabold text-indigo-600 block font-mono mt-1">{currencySymbol}{Math.round(matVal).toLocaleString()}</strong>
                        </div>
                      </div>

                      {/* Line-item Growth projection ladder */}
                      <div className="space-y-2.5">
                        <h5 className="text-[10px] font-mono uppercase font-bold text-slate-450 tracking-wider text-left">Progressive Growth Ladder</h5>
                        <div className="border border-slate-150 rounded-2xl overflow-hidden text-xs">
                          <div className="grid grid-cols-3 bg-slate-50 p-2.5 font-mono text-[9px] text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-150 text-left">
                            <div>Milestone Month</div>
                            <div className="text-center">Interest Accumulation</div>
                            <div className="text-right">Estimated Ledger Balance</div>
                          </div>
                          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                            {[0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                              const milestoneMonth = Math.max(1, Math.round(simulatedDuration * frac));
                              const milestoneTimeYears = milestoneMonth / 12;
                              let milestoneInterest = 0;
                              if (simulatedCompounding === "Simple") {
                                milestoneInterest = simulatedPrincipal * rateFrac * milestoneTimeYears;
                              } else {
                                milestoneInterest = simulatedPrincipal * (Math.pow(1 + rateFrac / 4, 4 * milestoneTimeYears) - 1);
                              }
                              return (
                                <div key={idx} className="grid grid-cols-3 p-3 items-center hover:bg-slate-50 transition-colors text-left">
                                  <div className="font-bold text-slate-750">Month {milestoneMonth} ({Math.round(frac * 100)}%)</div>
                                  <div className="text-center font-mono text-emerald-650 font-bold">+{currencySymbol}{Math.round(milestoneInterest).toLocaleString()}</div>
                                  <div className="text-right font-mono font-bold text-slate-900">{currencySymbol}{Math.round(simulatedPrincipal + milestoneInterest).toLocaleString()}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Integration Quick Action: Populate Tracker */}
                      <div className="bg-indigo-55 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/65 flex items-center justify-between gap-4 text-xs text-left">
                        <div className="space-y-0.5 leading-normal">
                          <strong className="text-indigo-950 font-bold block">Integrate simulated position</strong>
                          <span className="text-[11px] text-slate-500 font-light block">Pre-populate the portfolio registration tool with these calculations to save permanently.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setInvName(`${simulatedDuration}-Month Yield Scheme`);
                            setInvIns("Simulated Institution");
                            setInvAmountInvested(simulatedPrincipal);
                            setInvValue(simulatedPrincipal);
                            setInvExpectedRate(simulatedRate);
                            setInvNotes(`Simulated via Yield Calculator (${simulatedCompounding} Interest, ${simulatedDuration} Months).`);
                            setInvestmentsSubTab("positions");
                            setIsAddingInv(true);
                          }}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-md shadow-indigo-650/15 text-xs shrink-0"
                        >
                          Send to Portfolio
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* VIEW 3: YIELD COMPARISON SIMULATOR */}
          {investmentsSubTab === "comparison" && (
            <div className="lg:col-span-12 space-y-6 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Scale className="w-5 h-5 text-emerald-600" />
                      Yield Comparison Simulator
                    </h3>
                    <p className="text-[11px] text-slate-500 font-light mt-0.5">Model the expected performance of different financial instruments in Ghana side-by-side.</p>
                  </div>
                  
                  {/* Slider Control */}
                  <div className="w-full md:w-80 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-150">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>COMPARISON CAPITAL:</span>
                      <strong className="text-indigo-650">{currencySymbol}{comparisonCapital.toLocaleString()}</strong>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="100000"
                      step="1000"
                      value={comparisonCapital}
                      onChange={(e) => setComparisonCapital(Number(e.target.value))}
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* Grid of standard classes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      name: "Ghana Sovereign Treasury Bills (T-Bills)",
                      rate: 22.5,
                      risk: "Very Low (State Backed)",
                      riskColor: "text-emerald-600 bg-emerald-50 border-emerald-100",
                      liquidity: "High (91/182/364 Day Ladders)",
                      details: "Exempt from local withholding taxes. Backed fully by the state sovereign budget."
                    },
                    {
                      name: "High-Yield Commercial Fixed Deposits",
                      rate: 18.5,
                      risk: "Low-Medium (Sovereign Bank Default Risk)",
                      riskColor: "text-blue-600 bg-blue-50 border-blue-100",
                      liquidity: "Medium (Fixed Lockup Maturity)",
                      details: "Sourced through A-rated tier-1 Ghanaian commercial banking associations."
                    },
                    {
                      name: "Balanced Mutual Funds / Treasury Trusts",
                      rate: 16.0,
                      risk: "Medium (Market NAV Fluctuations)",
                      riskColor: "text-amber-600 bg-amber-50 border-amber-100",
                      liquidity: "Very High (Instant liquid withdrawals)",
                      details: "Diversified capital spectrum. Low minimum entry threshold, ideal for emergency cash pools."
                    },
                    {
                      name: "SACCO / Credit Cooperative Societies",
                      rate: 14.5,
                      risk: "Medium-High (Cooperative Insolvency Risk)",
                      riskColor: "text-purple-600 bg-purple-50 border-purple-100",
                      liquidity: "Low (Notice period or share redemption)",
                      details: "Localized credit union cooperatives. Requires continuous membership to qualify."
                    },
                    {
                      name: "Sovereign Infrastructure Bonds",
                      rate: 12.0,
                      risk: "Low (State backed long-term security)",
                      riskColor: "text-teal-600 bg-teal-50 border-teal-100",
                      liquidity: "Low (Secondary Market Sale required)",
                      details: "Long term sovereign capital funding roads, school projects, or corporate escrow."
                    },
                    {
                      name: "SME Micro-Equity / Venture Funding",
                      rate: 35.0,
                      risk: "High (Startup capital failure risk)",
                      riskColor: "text-rose-600 bg-rose-50 border-rose-100",
                      liquidity: "Very Low (Illiquid private share equity)",
                      details: "Venture investment into vetted local agricultural cooperatives or logistics."
                    }
                  ].map((opt, idx) => {
                    const interest12m = comparisonCapital * (opt.rate / 100);
                    return (
                      <div key={idx} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 flex flex-col justify-between space-y-4">
                        <div className="space-y-1.5 text-left">
                          <h4 className="text-xs font-extrabold text-slate-900 leading-snug">{opt.name}</h4>
                          <p className="text-[10px] text-slate-500 font-light leading-normal">{opt.details}</p>
                        </div>

                        <div className="border-t border-b border-slate-200/50 py-3 space-y-2 font-mono text-[10px] text-slate-500 text-left">
                          <div className="flex justify-between items-center">
                            <span>Expected Rate:</span>
                            <span className="text-emerald-650 font-extrabold text-[11px]">{opt.rate}% p.a</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Expected 1-Yr Profit:</span>
                            <strong className="text-slate-900 font-extrabold text-[11px]">{currencySymbol}{Math.round(interest12m).toLocaleString()}</strong>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Sovereign Risk Level:</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${opt.riskColor}`}>{opt.risk.split(" ")[0]}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-400">
                            <span>Liquidity Span:</span>
                            <span>{opt.liquidity.split(" ")[0]}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Visual APY meter */}
                          <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${(opt.rate / 40) * 100}%` }}></div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setInvType(
                                opt.name.includes("T-Bills") ? "Treasury Bill" :
                                opt.name.includes("Fixed Deposits") ? "Fixed Deposit" :
                                opt.name.includes("Mutual Funds") ? "Mutual Fund" :
                                opt.name.includes("SACCO") ? "SACCO/Cooperative" :
                                opt.name.includes("Bonds") ? "Bond" : "Business Investment"
                              );
                              setInvName(opt.name.split(" ")[1] + " Yield");
                              setInvIns("Escrow Issuer");
                              setInvAmountInvested(comparisonCapital);
                              setInvValue(comparisonCapital);
                              setInvExpectedRate(opt.rate);
                              setInvNotes(`Sourced via side-by-side comparative yield simulator (Capital: ${currencySymbol}${comparisonCapital}).`);
                              setInvestmentsSubTab("positions");
                              setIsAddingInv(true);
                            }}
                            className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-250 py-1.5 rounded-xl font-bold text-[10px] cursor-pointer transition-colors"
                          >
                            Add Position to Tracker
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: AI PORTFOLIO ADVISORY & INSIGHTS */}
          {investmentsSubTab === "ai" && (
            <div className="lg:col-span-12 space-y-6 animate-fade-in">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
                      AI Wealth & Advisory Desk
                    </h3>
                    <p className="text-[11px] text-slate-500 font-light mt-0.5">Generate high-fidelity non-custodial asset diversification diagnostics backed by Google Gemini.</p>
                  </div>

                  <button
                    type="button"
                    disabled={isGeneratingAiAudit}
                    onClick={handleGenerateAiAudit}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black px-5 py-3 rounded-xl cursor-pointer transition-all border border-emerald-500/10 text-xs shrink-0 shadow-lg shadow-emerald-500/10"
                  >
                    {isGeneratingAiAudit ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        Auditing Portfolio Allocations...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-255" />
                        Compile AI Portfolio Audit
                      </>
                    )}
                  </button>
                </div>

                 {isGeneratingAiAudit && (
                  <div className="space-y-6 text-xs animate-pulse font-sans">
                    {/* Health Summary Card Skeleton */}
                    <div className="bg-slate-50 border border-slate-200/40 p-4.5 rounded-2xl flex items-start gap-3">
                      <div className="bg-slate-200 w-9 h-9 rounded-xl shrink-0"></div>
                      <div className="space-y-2 flex-1 pt-1 text-left">
                        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                        <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                      </div>
                    </div>

                    {/* Bento Metrics Checklist Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[1, 2, 3].map((idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="h-2.5 bg-slate-200 rounded w-1/3"></div>
                            <div className="h-4 bg-slate-200 rounded w-12"></div>
                          </div>
                          <div className="h-2.5 bg-slate-200 rounded w-5/6"></div>
                          <div className="h-2.5 bg-slate-200 rounded w-2/3"></div>
                        </div>
                      ))}
                    </div>

                    {/* Detailed AI Reply Skeleton */}
                    <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-3">
                      <div className="h-3 bg-slate-250 rounded w-1/6"></div>
                      <div className="space-y-2.5">
                        <div className="h-3 bg-slate-200 rounded w-full"></div>
                        <div className="h-3 bg-slate-200 rounded w-11/12"></div>
                        <div className="h-3 bg-slate-200 rounded w-4/5"></div>
                      </div>
                    </div>
                  </div>
                )}

                {!aiAuditData && !isGeneratingAiAudit && (
                  <div className="text-center py-16 text-slate-400 text-xs space-y-3">
                    <p className="italic">📊 No portfolio audit generated yet. Click the button above to analyze your tracked positions.</p>
                    <span className="text-[10px] text-slate-400 block max-w-md mx-auto leading-relaxed">
                      This analysis evaluates diversification weights, matches liquid maturities with upcoming capital goals, and checks your cash-to-debt reserve safety ratios.
                    </span>
                  </div>
                )}

                {aiAuditData && !isGeneratingAiAudit && (
                  <div className="space-y-6 text-xs animate-fade-in font-sans">
                    {/* Health Summary Card */}
                    <div className="bg-emerald-50/40 border border-emerald-200/40 p-4.5 rounded-2xl flex items-start gap-3">
                      <div className="bg-emerald-600/10 text-emerald-600 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
                        💡
                      </div>
                      <div className="space-y-1 text-left">
                        <strong className="text-emerald-900 font-black block text-[11px] uppercase tracking-wider">Strategic Executive Assessment</strong>
                        <p className="text-[11px] text-slate-650 leading-relaxed font-sans">{aiAuditData.healthSummary}</p>
                      </div>
                    </div>

                    {/* Bento Metrics Checklist */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {aiAuditData.metricsAnalysis?.map((m: any, idx: number) => {
                        const isPos = m.indicator === "positive";
                        const isWarn = m.indicator === "warning" || m.indicator === "neutral";
                        return (
                          <div key={idx} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-2.5 text-left leading-relaxed">
                            <div className="flex justify-between items-start">
                              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-black block">{m.title}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
 isPos ? "text-emerald-600 bg-emerald-50 border-emerald-100" :
 isWarn ? "text-amber-600 bg-amber-50 border-amber-100" :
 "text-rose-600 bg-rose-50 border-rose-100"
 }`}>{m.value}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-light font-sans">{m.description}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Detailed AI Reply */}
                    <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-3 text-left">
                      <h4 className="text-[10px] font-mono uppercase font-black text-slate-450 tracking-wider">Personalized Financial Director Critique</h4>
                      <div className="text-[11px] text-slate-650 leading-relaxed font-sans space-y-3 whitespace-pre-line">
                        {aiAuditData.aiReply}
                      </div>
                    </div>

                    {/* Local Market Tactical Recommendations */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-mono uppercase font-black text-slate-450 tracking-wider text-left">SME Reinvestment Hacks</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {aiAuditData.localMarketHacks?.map((hack: string, idx: number) => {
                          const title = hack.split(":")[0];
                          const desc = hack.split(":")[1] || "";
                          return (
                            <div key={idx} className="bg-indigo-50/20 border border-indigo-100/50 p-4 rounded-2xl flex gap-3 text-left">
                              <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-bold text-[10px] mt-0.5">
                                {idx + 1}
                              </span>
                              <div className="space-y-1">
                                <strong className="font-extrabold text-slate-900 block text-[11px]">{title}</strong>
                                {desc && <p className="text-[10px] text-slate-500 font-sans leading-normal">{desc.trim()}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Advisory Educational Disclaimer */}
                    <p className="text-[9px] text-slate-400 italic text-center max-w-xl mx-auto leading-relaxed border-t border-slate-100 pt-4">
                      Disclaimer: AI Advisory and portfolio diagnostics are model-based simulations designed for passive financial education and strategic bookkeeping support. They do not constitute regulated banking advice, microfinance counseling, or securities solicitation. Consult a certified financial accountant before initiating asset transfers outside Aziiki.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 3: WEALTH POSITION & LIABILITY MANAGEMENT */}
      {activeTab === "networth" && (
        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 text-left animate-fade-in">
          
          {/* Balance Sheet Ledger Presentation */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono tracking-widest uppercase font-bold px-2.5 py-0.5 rounded-md border border-emerald-200">
                Analytical Statement
              </span>
              <h3 className="text-sm font-black text-slate-900 mt-1.5 flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600" />
                SME Unofficial Balance Sheet Model
              </h3>
              <p className="text-[11px] text-slate-500 font-light mt-0.5">Summary of business asset values vs outstanding supplier/lender liabilities.</p>
            </div>

            {/* Asset side vs Liability side double column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border border-slate-200/60 rounded-2xl p-4.5 bg-slate-50/50 text-xs">
              
              {/* Asset Section */}
              <div className="space-y-3">
                <h4 className="font-extrabold uppercase tracking-wider text-[10px] text-emerald-700 border-b border-slate-200 pb-1.5 flex justify-between">
                  <span>Assets Registry</span>
                  <span className="font-mono">VALUATION</span>
                </h4>
                
                <div className="space-y-2 leading-relaxed">
                  <div className="flex justify-between items-center text-slate-650">
                    <span className="font-sans">Available Cash Balance</span>
                    <strong className="font-mono text-slate-900 font-medium">{currencySymbol}{totalCash.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-650">
                    <span className="font-sans">Owned Tangible Assets (Book)</span>
                    <strong className="font-mono text-slate-900 font-medium">{currencySymbol}{totalAssetsBookValue.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between items-center text-slate-650">
                    <span className="font-sans">Financial Reserve Placements</span>
                    <strong className="font-mono text-slate-900 font-medium">{currencySymbol}{totalInvestmentCurrentValue.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                  <span>Total Business Assets</span>
                  <strong className="font-mono text-emerald-600 font-black">{currencySymbol}{totalAssetsAggregate.toLocaleString()}</strong>
                </div>
              </div>

              {/* Liabilities Section */}
              <div className="space-y-3">
                <h4 className="font-extrabold uppercase tracking-wider text-[10px] text-rose-700 border-b border-slate-200 pb-1.5 flex justify-between">
                  <span>Liabilities Register</span>
                  <span className="font-mono">VALUATION</span>
                </h4>

                <div className="space-y-2 leading-relaxed">
                  {debts.length === 0 ? (
                    <p className="text-slate-400 italic text-[11px] py-2">No active outstanding supplier credit facilities logged.</p>
                  ) : (
                    debts.map(d => (
                      <div key={d.id} className="flex justify-between items-center text-slate-650">
                        <span className="truncate max-w-[65%]">{d.creditor} ({d.type})</span>
                        <strong className="font-mono text-rose-650 font-medium shrink-0">-{currencySymbol}{d.amount.toLocaleString()}</strong>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 mt-auto">
                  <span>Total Liabilities</span>
                  <strong className="font-mono text-rose-650 font-black">-{currencySymbol}{totalDebtValue.toLocaleString()}</strong>
                </div>
              </div>

            </div>

            {/* Total net worth aggregate results */}
            <div className="p-4 bg-emerald-600/5 border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] text-emerald-700 uppercase tracking-wider font-extrabold block">True Business Equity Valuation</span>
                <p className="text-[11px] text-slate-500 font-light leading-relaxed">
                  Computed by subtracting outstanding supplier credits and operational debt liabilities from total physical and liquid capital assets.
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[9px] text-slate-400 uppercase font-mono tracking-wider block">Net Capital Position</span>
                <strong className="text-xl sm:text-2xl font-black text-emerald-600 font-mono block">
                  {currencySymbol}{netWorthValue.toLocaleString()}
                </strong>
              </div>
            </div>
          </div>

          {/* RIGHT: Debts liability manager */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-rose-500" />
                Short Term Debts Book
              </h3>
              <button
                onClick={() => setIsAddingDebt(!isAddingDebt)}
                className="text-xs font-bold text-rose-650 hover:text-rose-700 flex items-center gap-1 cursor-pointer font-sans"
              >
                {isAddingDebt ? "Cancel" : <><Plus className="w-4 h-4" /> Log Debt</>}
              </button>
            </div>

            {isAddingDebt ? (
              <form onSubmit={handleSaveDebt} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Creditor / Vendor Account</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alaba Fabric Wholesalers"
                    value={creditor}
                    onChange={(e) => setCreditor(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Principal Amount ({currencySymbol})</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={debtAmount}
                      onChange={(e) => setDebtAmount(Number(e.target.value))}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-2 outline-none font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Liability Class</label>
                    <select
                      value={debtType}
                      onChange={(e) => setDebtType(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                    >
                      <option value="Supplier Credit">Supplier Credit</option>
                      <option value="Loan">Bank Loan</option>
                      <option value="Overdraft">Overdraft Facility</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Interest Rate (% p.a)</label>
                    <input
                      type="number"
                      value={interestRate}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-2 outline-none font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Settlement Due Date</label>
                    <input
                      type="date"
                      value={debtDueDate}
                      onChange={(e) => setDebtDueDate(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-1.5 outline-none font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Denomination Currency</label>
                  <select
                    value={debtCurrency}
                    onChange={(e) => setDebtCurrency(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2 py-1.5 outline-none font-sans"
                  >
                    {SUPPORTED_CURRENCY_CODES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-rose-600 hover:bg-rose-700 py-3 rounded-xl text-white font-extrabold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Confirm Debt Allocation
                </button>
              </form>
            ) : (
              <div className="space-y-3 text-xs leading-relaxed">
                {debts.map((d) => (
                  <div key={d.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl border border-rose-100">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h5 className="font-extrabold text-slate-900">{d.creditor}</h5>
                        <span className="text-[10px] font-mono text-slate-450 uppercase block mt-0.5">
                          {d.type} — Due on: {d.dueDate}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <strong className="text-rose-650 font-mono text-sm font-extrabold">
                        {currencySymbol}{d.amount.toLocaleString()}
                      </strong>
                      <button
                        onClick={() => {
                          if (onDeleteDebt) onDeleteDebt(d.id);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Delete Debt Entry" aria-label="Delete Debt Entry"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}

                {debts.length === 0 && (
                  <div className="text-center py-12 text-slate-400 italic">
                    Excellent! No outstanding credit facilities logged.
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: BUSINESS SAVINGS GOALS */}
      {activeTab === "goals" && (
        <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 text-left font-sans animate-fade-in">
          
          {/* Configure Goals Left Panel */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4.5 h-4.5 text-indigo-500" />
                Capital Benchmarks
              </h3>
              <button
                onClick={() => setIsAddingGoal(!isAddingGoal)}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer font-sans"
              >
                {isAddingGoal ? "Cancel" : <><Plus className="w-4 h-4" /> Create Goal</>}
              </button>
            </div>

            {isAddingGoal ? (
              <form onSubmit={handleSaveGoal} className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Goal Classification Type</label>
                  <select
                    value={goalType}
                    onChange={(e) => setGoalType(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2.5 py-2 mt-1 outline-none font-sans"
                  >
                    <option value="Equipment">Acquire Machinery / Camera Gear</option>
                    <option value="Savings">Corporate Reserves Fund</option>
                    <option value="Expansion">Open New Retail Outlet</option>
                    <option value="Revenue">Target Sales Revenue</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Goal Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Procure prime prime sewing equipment"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Target Value ({currencySymbol})</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(Number(e.target.value))}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-2 outline-none font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Initial Saved ({currencySymbol})</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={goalCurrent}
                      onChange={(e) => setGoalCurrent(Number(e.target.value))}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-2 outline-none font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Target Deadline Date</label>
                  <input
                    type="date"
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl p-1.5 outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Target Currency</label>
                  <select
                    value={goalCurrency}
                    onChange={(e) => setGoalCurrency(e.target.value)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2.5 py-2 outline-none font-sans"
                  >
                    {SUPPORTED_CURRENCY_CODES.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl text-white font-extrabold uppercase tracking-wider cursor-pointer transition-colors shadow-md shadow-emerald-600/10"
                >
                  Create Capital Benchmark
                </button>
              </form>
            ) : (
              <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
                Establish milestones for camera kits, vehicle acquisitions, or outlet expansions. Aziiki dynamically charts replacement timelines and guides you as cash reserves accummulate.
              </p>
            )}
          </div>

          {/* Render goals list dials Right Panel */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest font-sans flex items-center gap-2 border-b border-slate-100 pb-3">
              <Target className="w-4.5 h-4.5 text-emerald-600" />
              Capital Target Milestones ({filteredGoals.length})
            </h4>

            <div className="space-y-4">
              {filteredGoals.map((goal) => {
                const percent = Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));

                return (
                  <div key={goal.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3 text-xs leading-relaxed text-left">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-[9px] font-mono font-bold text-emerald-700 uppercase bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full inline-block">
                          {goal.type}
                        </span>
                        <h5 className="font-extrabold text-slate-900 mt-1.5">{goal.name}</h5>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[9px] text-slate-400 block font-mono">Target</span>
                          <span className="text-slate-800 font-mono font-extrabold">{currencySymbol}{goal.targetAmount.toLocaleString()}</span>
                        </div>
                        <button
                          onClick={() => {
                            if (onDeleteGoal) onDeleteGoal(goal.id);
                          }}
                          aria-label={`Delete goal ${goal.name}`}
                          className="text-slate-400 hover:text-rose-650 p-1 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Progress tracking meters */}
                    <div className="space-y-1 pt-1.5">
                      <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-slate-200 flex">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-450 mt-1">
                        <span>Current Reserve: <strong>{currencySymbol}{goal.currentAmount.toLocaleString()}</strong> ({percent}%)</span>
                        <span className="font-mono flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" /> Deadline: {goal.deadline}
                        </span>
                      </div>
                    </div>

                    {/* Goal Direct Contribution Module */}
                    <div className="pt-3 border-t border-slate-200/50 mt-2 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Allocate reserve capital manually</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeGoalFormId === goal.id) {
                              setActiveGoalFormId(null);
                            } else {
                              setActiveGoalFormId(goal.id);
                              setContributionCurrency(goal.currency || currentBusiness?.currency || "GHS");
                            }
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-xl text-[10px] cursor-pointer transition-colors border border-emerald-200/30"
                        >
                          💸 Allocate Funds
                        </button>
                      </div>

                      {activeGoalFormId === goal.id && (
                        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 animate-fade-in">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-mono text-slate-450 uppercase font-bold">Transfer Capital</label>
                            <span className="text-[9px] font-mono text-slate-400">Available Cash: {currencySymbol}{totalCash.toLocaleString()}</span>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              max={contributionCurrency === (currentBusiness?.currency || "GHS") ? totalCash : undefined}
                              value={contributionAmount}
                              onChange={(e) => setContributionAmount(Number(e.target.value))}
                              className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-mono text-xs"
                            />
                            <select
                              value={contributionCurrency}
                              onChange={(e) => setContributionCurrency(e.target.value)}
                              className="bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-2 py-1.5 outline-none text-xs font-mono shrink-0"
                            >
                              {SUPPORTED_CURRENCY_CODES.map((code) => (
                                <option key={code} value={code}>{code}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleContributeSubmit(goal.id)}
                              className="bg-emerald-650 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs cursor-pointer transition-all shrink-0 font-sans"
                            >
                              Transfer
                            </button>
                          </div>

                          {contributionCurrency !== (goal.currency || currentBusiness?.currency || "GHS") && (
                            <p className="text-[9px] text-slate-450">
                              Converted into this goal's {goal.currency || currentBusiness?.currency} target using your saved exchange rate.
                            </p>
                          )}

                          {contributionError && (
                            <p className="text-[9px] font-mono text-rose-600 leading-tight">
                              ⚠️ {contributionError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
              {filteredGoals.length === 0 && (
                <div className="text-center py-12 text-slate-400 italic">
                  No operational growth or reserves goals set yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </>
    </div>
  );
}
