import React, { useState, useEffect, useMemo } from "react";
import { TrendUp as TrendingUp, TrendDown as TrendingDown, Calendar, Stack as Layers, Percent, Coins, BookOpen, ArrowRight, MagicWand as Sparkles, Question as HelpCircle, PiggyBank, CaretLeft as ChevronLeft, CaretRight as ChevronRight, Fire as Flame, CheckCircle as CheckCircle2, CurrencyDollar as DollarSign, Warning as AlertTriangle, Lightbulb } from "@phosphor-icons/react";
import AziikiWealthCalculator from "./AziikiWealthCalculator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";
import { Business, Transaction, Goal, Investment } from "../types";
import { getCurrencySymbol, SUPPORTED_CURRENCY_CODES } from "../lib/currency";
import { api } from "../lib/api";
import EmptyState from "./errors/EmptyState";

// AZIIKI BASIC VERSION 1.0 — kept in sync with the flag of the same name in
// App.tsx / InvoiceReceiptBuilder.tsx. Hides the multi-currency view toggle
// for launch (see the Brutal Product Teardown reconciliation).
const MVP_MODE = true;

interface FinancialReportsProps {
  currentBusiness: Business;
  transactions: Transaction[];
  goals: Goal[];
  investments: Investment[];
  currencySymbol: string;
  onContributeToGoal: (goalId: string, amount: number) => void;
  onAddTransaction: (newTx: any) => void;
}

// investment books data
const INVESTMENT_BOOKS = [
  {
    title: "The Richest Man in Babylon",
    author: "George S. Clason",
    key: "babylon",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    textColor: "text-amber-800",
    iconColor: "text-amber-600",
    principles: [
      {
        title: "Start Thy Purse to Fattening",
        desc: "Save at least 10% (one-tenth) of all you earn before paying anyone else. This is your seed money."
      },
      {
        title: "Control Thy Expenditures",
        desc: "Do not confuse necessary expenses with your desires. Budget your expenses so that you may have gold to pay yourself first."
      },
      {
        title: "Make Thy Gold Multiply",
        desc: "Put your savings to work. Reinvest interest and dividends. The earnings of your gold will earn more gold."
      },
      {
        title: "Guard Thy Treasures from Loss",
        desc: "Protect your capital. Avoid risky get-rich-quick schemes. Consult wise men who are experienced in handling gold."
      },
      {
        title: "Make of Thy Dwelling a Profitable Investment",
        desc: "Own your own business and operations site. Owning lowers your cost of living and builds true assets."
      },
      {
        title: "Ensure a Future Income",
        desc: "Provide in advance for your old age and the protection of your family through long-term compound growth."
      },
      {
        title: "Increase Thy Ability to Earn",
        desc: "Cultivate your skills, study, and grow wiser. The more knowledge you acquire, the more gold you will be enabled to earn."
      }
    ]
  },
  {
    title: "The Intelligent Investor",
    author: "Benjamin Graham",
    key: "intelligent",
    bgColor: "bg-indigo-500/10 border-indigo-500/30",
    textColor: "text-indigo-800",
    iconColor: "text-indigo-600",
    principles: [
      {
        title: "A Margin of Safety",
        desc: "Always pay less than an asset's intrinsic value to hedge against future downturns and unexpected errors."
      },
      {
        title: "Investment vs Speculation",
        desc: "An investment operation promises safety of principal and an adequate return. Speculating is taking unchecked risks for quick gains."
      },
      {
        title: "Define Your Investor Personae",
        desc: "Choose between being Defensive (passive indexing, low effort, low risk) or Enterprising (active, seeks undervalued opportunities)."
      },
      {
        title: "Meet Mr. Market",
        desc: "The market swings between wild optimism and extreme pessimism. Buy when he is depressed, sell when he is overenthusiastic."
      }
    ]
  },
  {
    title: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    key: "richdad",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
    textColor: "text-emerald-800",
    iconColor: "text-emerald-600",
    principles: [
      {
        title: "Assets Put Money IN Your Pocket",
        desc: "An asset is something that generates cash flow (businesses, stocks, real estate). Liabilities (nice cars, high bills) drag money OUT."
      },
      {
        title: "The Rich Do Not Work for Money",
        desc: "The rich make money work for them by acquiring cash-flowing assets. Do not lock yourself in a perpetual cycle of working for a regular salary."
      },
      {
        title: "Mind Your Own Business",
        desc: "Build and keep your asset column strong. Don't work your entire life making someone else or your suppliers rich."
      },
      {
        title: "Work to Learn, Don't Work to Earn",
        desc: "Seek jobs or gigs where you will learn sales, negotiation, management, and systems rather than just searching for a slightly higher wage."
      }
    ]
  },
  {
    title: "The Psychology of Money",
    author: "Morgan Housel",
    key: "psychology",
    bgColor: "bg-purple-500/10 border-purple-500/30",
    textColor: "text-purple-800",
    iconColor: "text-purple-600",
    principles: [
      {
        title: "Wealth is What You Don't See",
        desc: "Spending money to show people how much money you have is the quickest way to have less money. Real wealth is the assets you haven't spent yet."
      },
      {
        title: "Getting Rich vs. Staying Rich",
        desc: "Getting rich requires taking risks and being optimistic. Staying rich requires humility, survival instinct, and fearing that it can go away."
      },
      {
        title: "Use Money to Buy Control of Time",
        desc: "The highest dividend money pays is the ability to do what you want, when you want, with whom you want, for as long as you want."
      },
      {
        title: "The Magic of Compounding Loops",
        desc: "Good investing isn't necessarily about earning the highest returns. It's about earning pretty good returns that you can stick with for a long time."
      }
    ]
  }
];

export default function FinancialReports({
  currentBusiness,
  transactions: rawTransactions,
  goals,
  investments,
  currencySymbol: businessCurrencySymbol,
  onContributeToGoal,
  onAddTransaction
}: FinancialReportsProps) {
  // Report Period Type selection: "daily" | "weekly" | "monthly" | "quarterly" | "annual"
  const [periodType, setPeriodType] = useState<"daily" | "weekly" | "monthly" | "quarterly" | "annual">("monthly");

  // Phase E of the currency/localization redesign: a three-way view of the
  // same underlying data.
  // - "business": every transaction converted to the business's own
  //   currency via its own saved exchange rate (the CORRECT default - before
  //   this, every chart below silently summed raw amounts as if they were
  //   all already in the business currency, which is wrong once a document
  //   in a foreign currency exists).
  // - "original": no conversion - what was actually recorded. Only sound
  //   when every transaction shares one currency; a mixed-currency
  //   breakdown note is shown instead of a blended (meaningless) total.
  // - "custom": converted to business currency, then re-scaled to a chosen
  //   display currency using a saved exchange rate (pivoting through the
  //   business currency, since that's the only rate relationship we store).
  const [reportCurrencyMode, setReportCurrencyMode] = useState<"business" | "original" | "custom">("business");
  const [customDisplayCurrency, setCustomDisplayCurrency] = useState<string>(currentBusiness.currency);
  const [savedRates, setSavedRates] = useState<Record<string, number>>({});

  useEffect(() => {
    api.exchangeRates
      .list(currentBusiness.id)
      .then((rates: any[]) => {
        const map: Record<string, number> = {};
        for (const r of rates) map[r.currency] = r.rateToBusinessCurrency;
        setSavedRates(map);
      })
      .catch(() => {});
  }, [currentBusiness.id]);

  const currenciesPresent = useMemo(() => {
    const set = new Set<string>();
    for (const t of rawTransactions) {
      if (t.businessId === currentBusiness.id) set.add(t.currency || currentBusiness.currency);
    }
    return Array.from(set);
  }, [rawTransactions, currentBusiness.id, currentBusiness.currency]);

  const toBusinessCurrency = (t: Transaction): number =>
    t.currency && t.currency !== currentBusiness.currency ? t.amount * (t.exchangeRateToBusinessCurrency ?? 1) : t.amount;

  const businessToDisplay = (amountInBusinessCurrency: number): number => {
    if (customDisplayCurrency === currentBusiness.currency) return amountInBusinessCurrency;
    const rate = savedRates[customDisplayCurrency];
    return rate ? amountInBusinessCurrency / rate : amountInBusinessCurrency;
  };

  const transactions = useMemo(() => {
    if (reportCurrencyMode === "original") return rawTransactions;
    return rawTransactions.map((t) => {
      const businessAmount = toBusinessCurrency(t);
      const finalAmount = reportCurrencyMode === "custom" ? businessToDisplay(businessAmount) : businessAmount;
      return { ...t, amount: finalAmount };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTransactions, reportCurrencyMode, customDisplayCurrency, savedRates, currentBusiness.currency]);

  const currencySymbol = reportCurrencyMode === "custom" ? getCurrencySymbol(customDisplayCurrency) : businessCurrencySymbol;
  
  // Selected Date parameters
  const [selectedDate, setSelectedDate] = useState<string>("2026-06-28");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<string>("06"); // Defaults to June
  const [selectedQuarter, setSelectedQuarter] = useState<string>("Q2"); // Defaults to Q2 (Apr - Jun)

  // Helper to calculate the week range from a reference date string
  const getWeekRange = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day; // Adjust to Sunday
    const sunday = new Date(d.getFullYear(), d.getMonth(), diff);
    
    const format = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    
    // Generate the 7 days of this week
    const days = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(sunday.getTime() + i * 24 * 60 * 60 * 1000);
      days.push(format(nextDay));
    }
    
    return {
      start: days[0],
      end: days[6],
      days
    };
  };

  // Wisdom Slider state
  const [wisdomBookIndex, setWisdomBookIndex] = useState<number>(0);
  const [wisdomPrincipleIndex, setWisdomPrincipleIndex] = useState<number>(0);
  const [showWisdomPanel, setShowWisdomPanel] = useState<boolean>(false);

  // Pay-Yourself-First State
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [customPayAmount, setCustomPayAmount] = useState<string>("");
  const [paySuccessMsg, setPaySuccessMsg] = useState<string>("");

  // Populate goals selector default
  useEffect(() => {
    const savingsGoals = goals.filter(g => g.businessId === currentBusiness.id);
    if (savingsGoals.length > 0) {
      setSelectedGoalId(savingsGoals[0].id);
    } else {
      setSelectedGoalId("");
    }
  }, [goals, currentBusiness]);

  // Handle year picker updates
  const yearsList = [2024, 2025, 2026, 2027];
  
  const monthsList = [
    { label: "January", val: "01" },
    { label: "February", val: "02" },
    { label: "March", val: "03" },
    { label: "April", val: "04" },
    { label: "May", val: "05" },
    { label: "June", val: "06" },
    { label: "July", val: "07" },
    { label: "August", val: "08" },
    { label: "September", val: "09" },
    { label: "October", val: "10" },
    { label: "November", val: "11" },
    { label: "December", val: "12" }
  ];

  const quartersList = [
    { label: "Q1 (Jan - Mar)", val: "Q1", months: ["01", "02", "03"] },
    { label: "Q2 (Apr - Jun)", val: "Q2", months: ["04", "05", "06"] },
    { label: "Q3 (Jul - Sep)", val: "Q3", months: ["07", "08", "09"] },
    { label: "Q4 (Oct - Dec)", val: "Q4", months: ["10", "11", "12"] }
  ];

  // Helper: Filter records according to scope selection
  const getFilteredTransactions = () => {
    return transactions.filter(tx => {
      // Must match business ID
      if (tx.businessId !== currentBusiness.id) return false;
      
      if (periodType === "daily") {
        return tx.date === selectedDate;
      }
      
      if (periodType === "weekly") {
        const range = getWeekRange(selectedDate);
        return tx.date >= range.start && tx.date <= range.end;
      }
      
      const [year, month] = tx.date.split("-");
      const numYear = parseInt(year);
      
      if (numYear !== selectedYear) return false;
      
      if (periodType === "monthly") {
        return month === selectedMonth;
      }
      
      if (periodType === "quarterly") {
        const activeQuarterMonths = quartersList.find(q => q.val === selectedQuarter)?.months || [];
        return activeQuarterMonths.includes(month);
      }
      
      // Annual match simply returns true for matching year
      return true;
    });
  };

  const filteredTx = getFilteredTransactions();

  // Financial Metrics Summaries
  const totalIncome = filteredTx
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = filteredTx
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // Sourced active business goals
  const activeBusinessGoals = goals.filter(g => g.businessId === currentBusiness.id);
  const totalSavingsGoalTarget = activeBusinessGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalSavingsGoalSaved = activeBusinessGoals.reduce((sum, g) => sum + g.currentAmount, 0);

  // Total current investments registered
  const totalInvestmentsValue = investments.reduce((sum, inv) => sum + inv.value, 0);

  // 10% Gold Share payment amount computed
  const goldenTenPercent = totalIncome * 0.1;

  // Auto set recommended default contribution when golden income recalculates
  useEffect(() => {
    if (goldenTenPercent > 0) {
      setCustomPayAmount(Math.round(goldenTenPercent).toString());
    } else {
      setCustomPayAmount("50");
    }
  }, [goldenTenPercent]);

  // Handle Pay-Yourself Contribution
  const handleTriggerPayYourself = (e: React.FormEvent) => {
    e.preventDefault();
    const payVal = parseFloat(customPayAmount);
    if (isNaN(payVal) || payVal <= 0) return;

    if (selectedGoalId) {
      // Call standard goal contribution handler
      onContributeToGoal(selectedGoalId, payVal);
      const chosenGoal = goals.find(g => g.id === selectedGoalId);
      setPaySuccessMsg(`Success! Contributed ${currencySymbol}${payVal.toLocaleString()} into your "${chosenGoal?.name || "Savings"}" gold purse!`);
    } else {
      // Create separate Transaction record classified as operational self-pay "savings"
      const extraTx = {
        id: "tx-selfpay-" + Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString().split("T")[0],
        type: "expense",
        category: "Savings & Investments",
        amount: payVal,
        description: `Pay Yourself First: 10% Babylon protocol self allocation`,
        paymentMethod: "Cash",
        businessId: currentBusiness.id
      };
      onAddTransaction(extraTx);
      setPaySuccessMsg(`Success! Registered self-payment of ${currencySymbol}${payVal.toLocaleString()} into your ledger sandbox ledger!`);
    }

    setTimeout(() => {
      setPaySuccessMsg("");
    }, 4500);
  };

  // Organize charts dynamic trend data based on selected intervals
  const getTrendData = () => {
    if (periodType === "daily") {
      const output = [];
      const baseDate = new Date(selectedDate);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const targetStr = `${y}-${m}-${day}`;
        
        let inc = 0;
        let exp = 0;
        transactions
          .filter(t => t.businessId === currentBusiness.id && t.date === targetStr)
          .forEach(t => {
            if (t.type === "income") inc += t.amount;
            else exp += t.amount;
          });
        
        const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
        output.push({
          name: `${weekday} ${d.getDate()}`,
          Income: inc,
          Expense: exp,
          Savings: Math.max(0, inc - exp) * 0.1
        });
      }
      return output;
    } else if (periodType === "weekly") {
      const range = getWeekRange(selectedDate);
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return range.days.map((dayStr, index) => {
        let inc = 0;
        let exp = 0;
        transactions
          .filter(t => t.businessId === currentBusiness.id && t.date === dayStr)
          .forEach(t => {
            if (t.type === "income") inc += t.amount;
            else exp += t.amount;
          });
        
        const dObj = new Date(dayStr);
        return {
          name: `${dayNames[index]} ${dObj.getDate()}`,
          Income: inc,
          Expense: exp,
          Savings: Math.max(0, inc - exp) * 0.1
        };
      });
    } else if (periodType === "annual") {
      // Breakdown by Month
      const monthlyBuckets: { [key: string]: { income: number; expense: number } } = {};
      monthsList.forEach(m => {
        monthlyBuckets[m.val] = { income: 0, expense: 0 };
      });

      transactions
        .filter(t => t.businessId === currentBusiness.id && t.date.startsWith(selectedYear.toString()))
        .forEach(t => {
          const m = t.date.split("-")[1];
          if (monthlyBuckets[m]) {
            if (t.type === "income") monthlyBuckets[m].income += t.amount;
            else monthlyBuckets[m].expense += t.amount;
          }
        });

      return monthsList.map(m => ({
        name: m.label.substring(0, 3),
        Income: monthlyBuckets[m.val].income,
        Expense: monthlyBuckets[m.val].expense,
        Savings: Math.max(0, monthlyBuckets[m.val].income - monthlyBuckets[m.val].expense) * 0.1
      }));
    } else if (periodType === "quarterly") {
      // Breakdown by components months in that quarter
      const activeMonths = quartersList.find(q => q.val === selectedQuarter)?.months || [];
      const buckets: { [key: string]: { income: number; expense: number } } = {};
      activeMonths.forEach(m => {
        buckets[m] = { income: 0, expense: 0 };
      });

      transactions
        .filter(t => t.businessId === currentBusiness.id && t.date.startsWith(selectedYear.toString()))
        .forEach(t => {
          const m = t.date.split("-")[1];
          if (buckets[m]) {
            if (t.type === "income") buckets[m].income += t.amount;
            else buckets[m].expense += t.amount;
          }
        });

      return activeMonths.map(mStr => {
        const labelObj = monthsList.find(mon => mon.val === mStr);
        return {
          name: labelObj ? labelObj.label : mStr,
          Income: buckets[mStr].income,
          Expense: buckets[mStr].expense,
          Savings: Math.max(0, buckets[mStr].income - buckets[mStr].expense) * 0.1
        };
      });
    } else {
      // Monthly: break down into days or show current month values vs preceding 4 months
      // Let's show preceding 5 months and active month to see the trajectory of monthly income
      let targetDate = new Date(selectedYear, parseInt(selectedMonth) - 1, 15);
      const output = [];
      
      for (let i = 4; i >= 0; i--) {
        const d = new Date(targetDate.getTime());
        d.setMonth(d.getMonth() - i);
        const loopYear = d.getFullYear();
        const loopMonthRaw = d.getMonth() + 1;
        const loopMonthStr = loopMonthRaw < 10 ? `0${loopMonthRaw}` : loopMonthRaw.toString();
        
        let inc = 0;
        let exp = 0;
        
        transactions
          .filter(t => t.businessId === currentBusiness.id && t.date.startsWith(`${loopYear}-${loopMonthStr}`))
          .forEach(t => {
            if (t.type === "income") inc += t.amount;
            else exp += t.amount;
          });

        const labelObj = monthsList.find(mon => mon.val === loopMonthStr);
        output.push({
          name: labelObj ? labelObj.label.slice(0, 3) : loopMonthStr,
          Income: inc,
          Expense: exp,
          Savings: Math.max(0, inc - exp) * 0.1
        });
      }
      return output;
    }
  };

  const trendData = getTrendData();

  // Expense breakdown by categories in filtered transactions
  const getExpenseCategories = () => {
    const rawCategories: { [key: string]: number } = {};
    filteredTx
      .filter(t => t.type === "expense")
      .forEach(t => {
        const cat = t.category || "Uncategorized";
        rawCategories[cat] = (rawCategories[cat] || 0) + t.amount;
      });

    const parsed = Object.keys(rawCategories).map((name) => ({
      name,
      value: rawCategories[name]
    }));

    return parsed.length > 0 ? parsed : [{ name: "No Outlays Recorded", value: 0 }];
  };

  const expenseCategories = getExpenseCategories();

  // Elegant distinct theme palette matching standard dashboard looks
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#6366f1"];

  // Wisdom Book Carousel controls
  const handleWisdomBookNext = () => {
    setWisdomPrincipleIndex(0);
    setWisdomBookIndex((prev) => (prev + 1) % INVESTMENT_BOOKS.length);
  };

  const handleWisdomBookPrev = () => {
    setWisdomPrincipleIndex(0);
    setWisdomBookIndex((prev) => (prev - 1 + INVESTMENT_BOOKS.length) % INVESTMENT_BOOKS.length);
  };

  const currentBook = INVESTMENT_BOOKS[wisdomBookIndex];

  // automated smart analysis recommendations
  const getFinancialAdvice = () => {
    const advice = [];
    
    // Profit margin threshold analysis
    if (totalIncome === 0) {
      advice.push({
        type: "neutral",
        title: "Dormant Period Sales",
        body: "Your cash registry did not record inflows in this period. Seek client project leads or discount old inventory."
      });
    } else if (profitMargin < 10) {
      advice.push({
        type: "critical",
        title: "Thin Profit Outpost",
        body: `Your profit margin of ${profitMargin.toFixed(1)}% is razor thin. Review overhead costs, supplier rates, and avoid unnecessary logistics.`
      });
    } else if (profitMargin >= 30) {
      advice.push({
        type: "positive",
        title: "Excellent Operational Efficiency",
        body: `Sustaining a ${profitMargin.toFixed(1)}% margin is exceptional. Set aside at least half of this net profit into your 91-day Treasury Bills.`
      });
    }

    // Savings rate analysis
    const theoreticalSavings = theoreticalSavingsRate();
    if (totalIncome > 0 && theoreticalSavings < 10) {
      advice.push({
        type: "warning",
        title: "Slightly Off-target Gold Purse",
        body: `You saved less than 10% of revenue in this period. In 'The Richest Man in Babylon', failure to pay yourself 10% first delays compound wealth.`
      });
    } else if (totalIncome > 0) {
      advice.push({
        type: "positive",
        title: "Purse is Fattening Legally",
        body: "Your financial discipline aligns with classic principles! Consistent double-digit savings will protect you in volatile market rotations."
      });
    }

    // Investment coverage analysis
    if (totalInvestmentsValue === 0) {
      advice.push({
        type: "warning",
        title: "Under-utilized Investment Columns",
        body: "You have zero active investment assets logged. Idle cash in checking yields nothing. Consider mutual funds or treasury bills."
      });
    }

    return advice;
  };

  const theoreticalSavingsRate = () => {
    if (totalIncome <= 0) return 0;
    // We assume theoretical savings rate is based on total profit subtracted from what is stored as goals or 10% allocations
    // Let's just calculate how close the actual current savings goal contributions get to 10% of income
    return (totalSavingsGoalSaved / totalIncome) * 100;
  };

  const analysisReports = getFinancialAdvice();

  return (
    <div className="space-y-6" id="reports-and-wisdom-suite">
      
      {/* HEADER CONTROLS BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        <div className="md:col-span-6 text-left">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-1.5 rounded-lg az-chip-accent"><Calendar className="w-4 h-4" /></span>
            <h2 className="text-xl font-bold font-sans tracking-tight" style={{ color: "var(--text-primary)" }}>
              Reports &amp; Wisdom
            </h2>
          </div>
          <p className="text-xs ml-8" style={{ color: "var(--text-secondary)" }}>
            Audit your performance over custom cycles, pay yourself 10% first, and digest sovereign rules of money.
          </p>
        </div>

        {/* Interval Selector Tabs — horizontal-scroll on mobile so 5 options never wrap awkwardly. */}
        <div className="md:col-span-6 az-card az-elevation-1 p-1.5 flex gap-1 overflow-x-auto custom-scrollbar md:justify-end">
          {(["daily", "weekly", "monthly", "quarterly", "annual"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodType(p)}
              className="shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold font-sans transition-all cursor-pointer capitalize"
              style={periodType === p ? { background: "var(--accent)", color: "#fff" } : { color: "var(--text-secondary)" }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* AZIIKI BASIC VERSION 1.0: multi-currency view toggle hidden for launch —
          the Brutal Product Teardown flags Exchange Rates/multi-currency as
          unnecessary complexity for a launch cohort that's overwhelmingly
          single-currency. reportCurrencyMode simply stays "business" (its
          default) while this is hidden. Code preserved. */}
      {!MVP_MODE && (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row flex-wrap items-center gap-3 text-left shadow-sm">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans block shrink-0">
          View Amounts In:
        </span>
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setReportCurrencyMode("business")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold font-sans transition-all cursor-pointer ${
              reportCurrencyMode === "business" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-white"
            }`}
          >
            Business Currency ({currentBusiness.currency})
          </button>
          <button
            onClick={() => setReportCurrencyMode("original")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold font-sans transition-all cursor-pointer ${
              reportCurrencyMode === "original" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-white"
            }`}
          >
            Original Currency
          </button>
          <button
            onClick={() => setReportCurrencyMode("custom")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold font-sans transition-all cursor-pointer ${
              reportCurrencyMode === "custom" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-white"
            }`}
          >
            Choose Currency
          </button>
        </div>
        {reportCurrencyMode === "custom" && (
          <select
            value={customDisplayCurrency}
            onChange={(e) => setCustomDisplayCurrency(e.target.value)}
            className="bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none text-xs font-mono cursor-pointer"
          >
            {SUPPORTED_CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        )}
        {reportCurrencyMode === "custom" && customDisplayCurrency !== currentBusiness.currency && !savedRates[customDisplayCurrency] && (
          <span className="text-[10px] text-amber-600 font-sans">
            No saved rate for {customDisplayCurrency} yet - showing 1:1 with {currentBusiness.currency}. Add one in the "Exchange Rates" pane for an accurate conversion.
          </span>
        )}
        {reportCurrencyMode === "original" && currenciesPresent.length > 1 && (
          <div className="w-full mt-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 text-[11px]">
            <span className="font-bold">Heads up:</span> transactions in this period span {currenciesPresent.length} currencies
            ({currenciesPresent.join(", ")}). Totals shown below add raw amounts across currencies, which isn't a real sum -
            switch to "Business Currency" for an accurate combined total.
          </div>
        )}
      </div>
      )}

      {/* FILTER DRAWER SELECTOR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row flex-wrap items-center gap-4 text-left shadow-sm">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-sans block">
          Select Reporting Scope:
        </span>
        
        <div className="flex flex-wrap items-center gap-3.5">
          {/* Date Selector for Daily/Weekly */}
          {(periodType === "daily" || periodType === "weekly") && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold">
                {periodType === "daily" ? "Select Date" : "Week Reference Date"}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  const parts = e.target.value.split("-");
                  if (parts.length === 3) {
                    setSelectedYear(parseInt(parts[0]));
                    setSelectedMonth(parts[1]);
                  }
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Year selector */}
          {(periodType === "monthly" || periodType === "quarterly" || periodType === "annual") && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:ring-1 focus:ring-indigo-500"
              >
                {yearsList.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {/* Month selective (Only shows on monthly period) */}
          {periodType === "monthly" && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:ring-1 focus:ring-indigo-500"
              >
                {monthsList.map(m => (
                  <option key={m.val} value={m.val}>{m.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Quarter selective (Only shows on quarterly period) */}
          {periodType === "quarterly" && (
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-bold">Quarter</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 cursor-pointer focus:ring-1 focus:ring-indigo-500"
              >
                {quartersList.map(q => (
                  <option key={q.val} value={q.val}>{q.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="sm:ml-auto flex items-center gap-1.5 text-indigo-600 text-xs font-bold font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          {filteredTx.length} records processed
          {periodType === "daily" && ` for ${selectedDate}`}
          {periodType === "weekly" && ` for week starting ${getWeekRange(selectedDate).start}`}
          {periodType === "monthly" && ` for ${selectedYear} - ${monthsList.find(m => m.val === selectedMonth)?.label}`}
          {periodType === "quarterly" && ` for ${selectedYear} - ${selectedQuarter}`}
          {periodType === "annual" && ` for ${selectedYear}`}
        </div>
      </div>

      {/* METRIC SUMMARIES — horizontal-scroll on phones, same pattern as the Dashboard's metric row. */}
      <div className="flex lg:grid lg:grid-cols-4 gap-4 overflow-x-auto sm:overflow-visible -mx-1 px-1 pb-1 sm:pb-0 custom-scrollbar">
        {/* Income Card */}
        <div className="az-card az-card-interactive az-elevation-1 p-5 text-left shrink-0 w-[75vw] sm:w-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: "var(--text-tertiary)" }}>
              Inflow Revenue
            </span>
            <div className="p-2 rounded-xl az-chip-positive">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
            {currencySymbol}{totalIncome.toLocaleString()}
          </h3>
          <p className="text-[10.5px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Total ledger receipts captured for current period
          </p>
        </div>

        {/* Expenses Card */}
        <div className="az-card az-card-interactive az-elevation-1 p-5 text-left shrink-0 w-[75vw] sm:w-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: "var(--text-tertiary)" }}>
              Outflow Costs
            </span>
            <div className="p-2 rounded-xl az-chip-negative">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
            {currencySymbol}{totalExpense.toLocaleString()}
          </h3>
          <p className="text-[10.5px] mt-1" style={{ color: "var(--text-secondary)" }}>
            Wages, fuel, materials and general overhead outlays
          </p>
        </div>

        {/* Net Profit card */}
        <div className="az-card az-card-interactive az-elevation-1 p-5 text-left shrink-0 w-[75vw] sm:w-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: "var(--text-tertiary)" }}>
              Net Surplus / Loss
            </span>
            <div className={`p-2 rounded-xl ${netProfit >= 0 ? "az-chip-positive" : "az-chip-negative"}`}>
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight" style={{ color: netProfit >= 0 ? "var(--positive)" : "var(--negative)" }}>
            {netProfit >= 0 ? "" : "-"}{currencySymbol}{Math.abs(netProfit).toLocaleString()}
          </h3>
          <p className="text-[10.5px] mt-1 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            Margin:
            <span className="font-bold" style={{ color: profitMargin >= 20 ? "var(--positive)" : "var(--text-secondary)" }}>
              {profitMargin.toFixed(1)}%
            </span>
          </p>
        </div>

        {/* Dynamic Pay Yourself first 10% Gold coins target card — intentionally
            kept as its own warm/gold accent (not the standard token palette),
            it's a themed motivational callout, not a neutral data card. */}
        <div className="az-card az-elevation-1 p-5 text-left shrink-0 w-[75vw] sm:w-auto" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--warning) 8%, var(--surface-card)), var(--surface-card))", borderColor: "color-mix(in srgb, var(--warning) 35%, var(--border-subtle))" }}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: "var(--warning)" }}>
              10% Babylon Share
            </span>
            <div className="p-2 rounded-xl az-chip-warning">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black tracking-tight" style={{ color: "var(--warning)" }}>
            {currencySymbol}{goldenTenPercent.toLocaleString()}
          </h3>
          <p className="text-[10.5px] mt-1 font-sans" style={{ color: "var(--text-secondary)" }}>
            "Thy gold coins saved are thine own workers."
          </p>
        </div>
      </div>

      {/* CHARTS CONTAINER: Trend Lines & Category Outlays */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Financial Trend performance chart (Recharts) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm text-left">
          <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">
                Financial Trend Outlook
              </h4>
              <span className="text-[10px] text-slate-500">
                Performance indicators across selected {periodType === "annual" ? "annual months" : periodType === "quarterly" ? "quarter months" : "trailing months"}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-[10px] font-bold font-mono">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Inflow</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Outflow</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Babylon 10%</span>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSav" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.1} />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "rgba(17, 24, 39, 0.95)", 
                    borderRadius: "12px", 
                    borderColor: "#374151",
                    color: "#fff"
                  }} 
                />
                <Area type="monotone" dataKey="Income" name="Inflow" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="Expense" name="Outflow" stroke="#ef4444" strokeWidth={1.5} fillOpacity={1} fill="url(#colorExpense)" />
                <Area type="monotone" dataKey="Savings" name="Babyon Goal (10%)" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSav)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Outlay categories representation pie */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm text-left flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans mb-1">
              Outlay Cost Breakdown
            </h4>
            <span className="text-[10px] text-slate-500 block">
              Expense categories distribution for selected range
            </span>
          </div>

          <div className="h-[180px] w-full mt-3 flex items-center justify-center relative">
            {expenseCategories.length === 1 && expenseCategories[0].value === 0 ? (
              <div className="text-center p-4">
                <AlertTriangle className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                <span className="text-[10px] text-slate-400 font-mono">No outlays registered</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expenseCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `${currencySymbol}${value.toLocaleString()}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            
            {/* Center Summary details */}
            {totalExpense > 0 && (
              <div className="absolute flex flex-col items-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase font-mono">Total Spent</span>
                <span className="text-xs font-bold text-slate-800">
                  {currencySymbol}{totalExpense.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1 text-[10px] mt-4">
            {expenseCategories.filter(c => c.value > 0).map((cObj, idx) => {
              const p = totalExpense > 0 ? (cObj.value / totalExpense) * 100 : 0;
              return (
                <div key={idx} className="flex justify-between items-center text-slate-700">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                    <span className="truncate max-w-[130px] font-sans font-bold">{cObj.name}</span>
                  </div>
                  <span className="font-mono text-slate-500 shrink-0">
                    {currencySymbol}{cObj.value.toLocaleString()} ({p.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* CORE INTEGRATION BLOCK: "The Richest Man in Babylon" Pay-Yourself-First (10% Gold share contribution tool) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Golden Tablet Pay-Yourself-First panel */}
        <div className="lg:col-span-7 bg-gradient-to-r from-amber-900 to-amber-950 text-amber-50 rounded-3xl p-6 text-left border border-amber-700 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[350px]">
          
          {/* Subtle gold coins watermark layer */}
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-1/4 translate-x-1/6">
            <Coins className="w-72 h-72" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-extrabold tracking-tight text-amber-300 uppercase font-sans">
                The 10% Gold Share Covenant
              </h3>
            </div>

            <div className="bg-amber-905/30 border-l-4 border-amber-500 p-4 rounded-r-xl">
              <blockquote className="italic text-sm text-amber-100 font-sans leading-relaxed">
                "A part of all you earn is yours to keep. It should be not less than one-tenth no matter how little you earn. Pay yourself first before you pay for food, shoes, and luxury. Let thy gold represent a diligent slave that multiplies in thy treasure drawers."
              </blockquote>
              <cite className="block text-[10px] text-amber-400 mt-2 font-mono uppercase tracking-widest font-bold">
                — Arkad, The Richest Man in Babylon
              </cite>
            </div>

            <p className="text-xs text-amber-200/80 leading-relaxed font-sans max-w-xl">
              By depositing exactly 10% of your business revenues immediately into savings vaults prior to settling supplier margins, you guarantee that your lifetime physical labor accrues equity to you, not others.
            </p>
          </div>

          {/* Form Widget for Golden self-pay trigger */}
          <form onSubmit={handleTriggerPayYourself} className="relative z-10 bg-amber-950/60 p-4 rounded-2xl border border-amber-800 space-y-3 mt-4">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-widest font-sans flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              Acquire Gold Coins Instantly
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-[10px] uppercase font-bold text-amber-400 font-mono block mb-1">
                  Target Savings Goal Vault
                </label>
                {activeBusinessGoals.length > 0 ? (
                  <select
                    value={selectedGoalId}
                    onChange={(e) => setSelectedGoalId(e.target.value)}
                    className="w-full bg-amber-950 text-amber-100 border border-amber-700 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer outline-none focus:border-amber-400"
                  >
                    {activeBusinessGoals.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.type}) - Saved: {currencySymbol}{g.currentAmount}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[11px] text-amber-200/60 bg-amber-950 border border-amber-900/60 rounded-xl p-2 font-mono">
                    ⚠️ No active Savings Goals found. (Contributions log to general ledger sandbox ledger)
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-amber-400 font-mono block mb-1">
                  10% Self Payment Amount ({currencySymbol})
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customPayAmount}
                    onChange={(e) => setCustomPayAmount(e.target.value)}
                    className="w-full bg-amber-950 text-amber-50 border border-amber-700 rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-amber-400"
                    placeholder="Enter gold coins amount"
                    required
                  />
                  
                  <button
                    type="button"
                    onClick={() => {
                      if (goldenTenPercent > 0) setCustomPayAmount(Math.round(goldenTenPercent).toString());
                    }}
                    className="bg-amber-800 hover:bg-amber-700 text-amber-100 px-2 py-1 rounded-xl text-[10px] font-bold select-none cursor-pointer border border-amber-600 self-center"
                    title="Reset to computed 10%" aria-label="Reset to computed 10%"
                  >
                    Max 10%
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs uppercase py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/10 shrink-0"
            >
              <Coins className="w-4 h-4 text-amber-950" />
              Pay Myself First Now
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Success micro response */}
            {paySuccessMsg && (
              <div className="p-2 bg-amber-500 text-amber-950 font-bold border border-amber-300 text-center rounded-xl text-[11px] animate-bounce">
                {paySuccessMsg}
              </div>
            )}
          </form>
        </div>

        {/* Dynamic sliding investment rules panel */}
        <div className={`lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm text-left flex flex-col justify-between transition-all duration-305 ${showWisdomPanel ? "min-h-[350px]" : "min-h-[140px]"}`}>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider font-sans">
                  Sovereign Book Wisdom
                </h3>
              </div>
              
              <button
                onClick={() => setShowWisdomPanel(!showWisdomPanel)}
                className="text-[11px] font-bold text-indigo-600 hover:underline px-3 py-1 bg-indigo-50 rounded-lg cursor-pointer"
              >
                {showWisdomPanel ? "Collapse ▴" : "Expand wisdom ▾"}
              </button>
            </div>

            {!showWisdomPanel ? (
              <div 
                onClick={() => setShowWisdomPanel(true)}
                className="p-3 bg-indigo-50/40 border border-indigo-100/60 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-all flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-sm">📖</span>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800 font-sans">
                    Read financial guidelines from the experts
                  </p>
                  <p className="text-[10px] text-slate-450 font-mono">
                    Includes {INVESTMENT_BOOKS.length} volumes: {INVESTMENT_BOOKS.map(b => b.title.split(" ")[0]).join(", ")}...
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Pagination controls inside */}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-[10px] font-heavy text-indigo-600 uppercase tracking-widest font-mono">
                    Book #{wisdomBookIndex + 1} of {INVESTMENT_BOOKS.length} Summary
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleWisdomBookPrev}
                      className="p-1.5 hover:bg-slate-50 border border-slate-250 rounded-xl cursor-pointer text-slate-500"
                      title="Previous Book" aria-label="Previous Book"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleWisdomBookNext}
                      className="p-1.5 hover:bg-slate-50 border border-slate-250 rounded-xl cursor-pointer text-slate-500"
                      title="Next Book" aria-label="Next Book"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-black text-slate-900 leading-snug">
                    {currentBook.title}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono italic">
                    By {currentBook.author}
                  </p>
                </div>

                {/* Carousel / sliding principles */}
                <div className={`p-4 border rounded-2xl ${currentBook.bgColor} transition-all duration-300 min-h-[160px] flex flex-col justify-between`}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-indigo-600 font-mono">
                        Rule #{wisdomPrincipleIndex + 1}:
                      </span>
                      <span className={`text-xs font-bold ${currentBook.textColor} font-sans`}>
                        {currentBook.principles[wisdomPrincipleIndex].title}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-650 leading-relaxed">
                      {currentBook.principles[wisdomPrincipleIndex].desc}
                    </p>
                  </div>

                  {/* Principle micro selector beads */}
                  <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200/20">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {wisdomPrincipleIndex + 1} of {currentBook.principles.length} core rules
                    </span>
                    
                    <div className="flex gap-1">
                      {currentBook.principles.map((_, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => setWisdomPrincipleIndex(pIdx)}
                          className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
 wisdomPrincipleIndex === pIdx ? "bg-indigo-600 w-4" : "bg-slate-350"
 }`}
                        ></button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {showWisdomPanel && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-2 mt-4 animate-fade-in">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[10px] text-slate-600 font-sans leading-relaxed">
                <strong>Study Guide:</strong> High interest premiums (like Sovereign GHS 91-Day Bills) yield up to 21% returns. Double check inflation metrics prior to deploying offline holdings.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* ANALYSIS AND INTELLIGENT EXECUTIVE ALERTS (Sourced automatically) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm text-left">
        <div className="border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-sans">
              Smart CFO Advisory Engine
            </h3>
            <span className="text-[10px] text-slate-550 block">Instant audit recommendations generated based on current records</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analysisReports.map((r, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex gap-3 ${
 r.type === "positive"
 ? "bg-emerald-50/40 border-emerald-250 text-slate-800"
 : r.type === "warning"
 ? "bg-amber-50/40 border-amber-250 text-slate-800"
 : r.type === "critical"
 ? "bg-red-50/40 border-red-250 text-slate-800"
 : "bg-slate-50 border-slate-250 text-slate-800"
 }`}
            >
              <div className="shrink-0 mt-0.5">
                {r.type === "positive" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : r.type === "warning" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                ) : r.type === "critical" ? (
                  <Flame className="w-4 h-4 text-red-650" />
                ) : (
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-slate-900">
                  {r.title}
                </h5>
                <p className="text-[11px] text-slate-650 leading-relaxed">
                  {r.body}
                </p>
              </div>
            </div>
          ))}

          {analysisReports.length === 0 && (
            <div className="col-span-3">
              <EmptyState
                compact
                icon={Lightbulb}
                title="No advisory alerts right now"
                message="Once you've logged a few transactions, this space will surface useful patterns and suggestions automatically."
              />
            </div>
          )}
        </div>
      </div>

      {/* AZIIKI BASIC VERSION 1.0: standalone compound-interest / savings-growth
          calculator, added to Core V1 per the latest spec. Purely client-side —
          does not read from or write to the (currently hidden) full Wealth &
          Goals / NetWorthInvestments module. */}
      <AziikiWealthCalculator currencySymbol={businessCurrencySymbol} />

    </div>
  );
}
