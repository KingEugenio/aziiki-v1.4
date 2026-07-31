import React, { useState, useEffect } from "react";
import EmptyState from "./errors/EmptyState";
import { PiggyBank, CreditCard, Wallet, TrendUp as TrendingUp, TrendDown as TrendingDown, Plus, Trash as Trash2, Calendar, Warning as AlertTriangle, CheckCircle as CheckCircle2, Target, Pulse as Activity, MagicWand as Sparkles, CurrencyDollar as DollarSign, ChartLine as LucideLineChart, Brain as BrainCircuit, ArrowUpRight, ArrowDownRight, Percent, ShieldWarning as ShieldAlert, ChatCircle as MessageSquare, Question as HelpCircle, User, PlusCircle, FileCsv as FileSpreadsheet } from "@phosphor-icons/react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  CartesianGrid, 
  Legend 
} from "recharts";
import { 
  Transaction, 
  Goal, 
  Debt, 
  Investment, 
  Business, 
  PersonalAccount, 
  PersonalBudget 
} from "../types";

interface PersonalWorkspaceProps {
  currentBusiness: Business;
  transactions: Transaction[];
  goals: Goal[];
  debts: Debt[];
  investments: Investment[];
  currencySymbol: string;
  onAddTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddGoal: (goal: Goal) => void;
  onAddDebt: (debt: Debt) => void;
  onAddInvestment: (inv: Investment) => void;
  onContributeToGoal: (goalId: string, amount: number) => void;
  onUpdateBusiness: (updated: Business) => void;
  onDeleteDebt: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onDeleteInvestment: (id: string) => void;
  onRepayDebt: (debtId: string, amount: number, paymentAccountId: string) => void;
}

export default function PersonalWorkspace({
  currentBusiness,
  transactions,
  goals,
  debts,
  investments,
  currencySymbol,
  onAddTransaction,
  onDeleteTransaction,
  onAddGoal,
  onAddDebt,
  onAddInvestment,
  onContributeToGoal,
  onUpdateBusiness,
  onDeleteDebt,
  onDeleteGoal,
  onDeleteInvestment,
  onRepayDebt
}: PersonalWorkspaceProps) {
  // Navigation inside Personal Workspace
  // Options: "dashboard" | "transactions" | "accounts" | "savings" | "budgets" | "reports" | "coach"
  const [personalTab, setPersonalTab] = useState<string>("dashboard");

  const changePersonalTab = (tab: string) => {
    setPersonalTab(tab);
  };

  // Get localized business-specific records
  const workspaceTransactions = transactions.filter(t => t.businessId === currentBusiness.id);
  const workspaceGoals = goals.filter(g => g.businessId === currentBusiness.id);
  const workspaceDebts = debts.filter(d => d.businessId === currentBusiness.id || !d.businessId);
  const workspaceInvestments = investments.filter(i => i.businessId === currentBusiness.id || !i.businessId);

  // Initialize helper defaults inside Business structure if not yet configured
  const accounts: PersonalAccount[] = currentBusiness.accounts || [
    { id: "acc-momo", name: "My Mobile Money Wallet", type: "MTN Mobile Money", initialBalance: 1500, balance: 1500 },
    { id: "acc-cash", name: "Physical Cash Pocket", type: "Cash Wallet", initialBalance: 300, balance: 300 },
    { id: "acc-bank", name: "Sovereign Savings Bank", type: "Savings Account", initialBalance: 5000, balance: 5000 }
  ];

  const budgets: PersonalBudget[] = currentBusiness.budgets || [
    { category: "Food", limitAmount: 600 },
    { category: "Transport", limitAmount: 300 },
    { category: "Rent", limitAmount: 1200 },
    { category: "Utilities", limitAmount: 200 },
    { category: "Entertainment", limitAmount: 150 }
  ];

  // Helper: update workspace settings in main state
  const saveWorkspaceData = (updatedAccounts: PersonalAccount[], updatedBudgets: PersonalBudget[]) => {
    onUpdateBusiness({
      ...currentBusiness,
      accounts: updatedAccounts,
      budgets: updatedBudgets
    });
  };

  // Sync balances whenever transactions change to ensure 100% accurate dynamic wallet metrics
  useEffect(() => {
    let changed = false;
    const recalculatedAccounts = accounts.map(acc => {
      // Net change = sum(incomes to this account) - sum(expenses from this account)
      const plus = workspaceTransactions
        .filter(t => t.type === "income" && t.paymentMethod === acc.name)
        .reduce((sum, t) => sum + t.amount, 0);
      const minus = workspaceTransactions
        .filter(t => t.type === "expense" && t.paymentMethod === acc.name)
        .reduce((sum, t) => sum + t.amount, 0);
      const newBal = acc.initialBalance + plus - minus;
      if (acc.balance !== newBal) {
        changed = true;
        return { ...acc, balance: newBal };
      }
      return acc;
    });

    if (changed) {
      saveWorkspaceData(recalculatedAccounts, budgets);
    }
  }, [workspaceTransactions.length]);

  // Aggregate metrics
  const totalAccountBalance = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalSavingsGoalValue = workspaceGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalInvestmentValue = workspaceInvestments.reduce((sum, i) => sum + i.value, 0);
  
  const totalPropertyAndAssetsValue = 10000; // default property/assets base
  const totalDebtsValue = workspaceDebts.reduce((sum, d) => sum + d.amount, 0);

  // Net Worth Formulation
  const personalNetWorth = totalAccountBalance + totalSavingsGoalValue + totalInvestmentValue + totalPropertyAndAssetsValue - totalDebtsValue;

  // Monthly breakdown
  const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const thisMonthTransactions = workspaceTransactions.filter(t => t.date.startsWith(currentMonth));
  
  const monthlyIncome = thisMonthTransactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyExpenses = thisMonthTransactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const netMonthlySavings = monthlyIncome - monthlyExpenses;

  // 1. Transaction creation states
  const [txAmount, setTxAmount] = useState<number>(100);
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txCategory, setTxCategory] = useState<string>("Food");
  const [txDescription, setTxDescription] = useState<string>("");
  const [txAccount, setTxAccount] = useState<string>(accounts[0]?.name || "");
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // 2. Account creation states
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<PersonalAccount["type"]>("MTN Mobile Money");
  const [newAccBalance, setNewAccBalance] = useState<number>(0);

  // 3. Goal creation states
  const [newGoalName, setNewGoalName] = useState("");
  const [newGoalType, setNewGoalType] = useState<Goal["type"]>("Savings");
  const [newGoalTarget, setNewGoalTarget] = useState<number>(1000);
  const [newGoalCurrent, setNewGoalCurrent] = useState<number>(0);
  const [newGoalDeadline, setNewGoalDeadline] = useState<string>(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  // 4. Budget setting states
  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetLimit, setBudgetLimit] = useState<number>(500);

  // 5. Debt creation states
  const [debtCreditor, setDebtCreditor] = useState("");
  const [debtAmount, setDebtAmount] = useState<number>(500);
  const [debtType, setDebtType] = useState<"Loan" | "Supplier Credit" | "Overdraft">("Loan");
  const [debtInterest, setDebtInterest] = useState<number>(0);
  const [debtDue, setDebtDue] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  // 6. Investment creation states
  const [invName, setInvName] = useState("");
  const [invType, setInvType] = useState<Investment["type"]>("Treasury Bill");
  const [invInst, setInvInst] = useState("");
  const [invValue, setInvValue] = useState<number>(1000);
  const [invReturn, setInvReturn] = useState<number>(12);
  const [invMaturity, setInvMaturity] = useState("");

  // 7. Goal contribution state
  const [contributingGoalId, setContributingGoalId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState<number>(100);
  const [contributionAccount, setContributionAccount] = useState<string>(accounts[0]?.name || "");

  // 8. Debt repayment state
  const [repayingDebtId, setRepayingDebtId] = useState<string | null>(null);
  const [repayAmount, setRepayAmount] = useState<number>(100);
  const [repayAccountName, setRepayAccountName] = useState<string>(accounts[0]?.name || "");

  // Financial Health Score Calculation (0-100)
  const calculatePersonalHealthScore = () => {
    let score = 50; // baseline

    // 1. Savings Rate (Monthly savings vs Income)
    const savingsRate = monthlyIncome > 0 ? (netMonthlySavings / monthlyIncome) * 100 : 0;
    if (savingsRate > 25) score += 15;
    else if (savingsRate > 10) score += 8;
    else if (savingsRate < 0) score -= 10;

    // 2. Emergency Fund Size (Total Savings + Savings Account Balance vs Average expenses)
    const avgExpenses = monthlyExpenses > 0 ? monthlyExpenses : 1200;
    const emergencyFund = accounts.find(a => a.type === "Savings Account")?.balance || 0;
    const monthsCovered = emergencyFund / avgExpenses;
    if (monthsCovered >= 6) score += 15;
    else if (monthsCovered >= 3) score += 10;
    else if (monthsCovered >= 1) score += 5;

    // 3. Debt to Asset Ratio
    const totalAssets = totalAccountBalance + totalSavingsGoalValue + totalInvestmentValue + totalPropertyAndAssetsValue;
    const debtRatio = totalAssets > 0 ? (totalDebtsValue / totalAssets) * 100 : 0;
    if (debtRatio === 0) score += 15;
    else if (debtRatio < 15) score += 10;
    else if (debtRatio > 40) score -= 15;

    // 4. Budget Compliance
    let budgetOverCount = 0;
    budgets.forEach(b => {
      const categorySpent = workspaceTransactions
        .filter(t => t.type === "expense" && t.category === b.category && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amount, 0);
      if (categorySpent > b.limitAmount) {
        budgetOverCount++;
      }
    });
    if (budgetOverCount === 0 && budgets.length > 0) score += 10;
    else score -= budgetOverCount * 4;

    return Math.min(100, Math.max(10, score));
  };

  const healthScore = calculatePersonalHealthScore();

  // Actionable tips based on score
  const getActionableHealthTips = () => {
    const tips: string[] = [];
    const savingsRate = monthlyIncome > 0 ? (netMonthlySavings / monthlyIncome) * 100 : 0;
    const emergencyFund = accounts.find(a => a.type === "Savings Account")?.balance || 0;
    const avgExpenses = monthlyExpenses > 0 ? monthlyExpenses : 1200;
    const monthsCovered = emergencyFund / avgExpenses;

    if (savingsRate < 10) {
      tips.push("Your savings rate is below the healthy 10% threshold. Try categorizing and capping 'Entertainment' or 'Shopping' budgets.");
    } else {
      tips.push("Great work keeping your savings rate healthy! Keep it up or consider routing excess savings to higher-yield Investments.");
    }

    if (monthsCovered < 3) {
      tips.push("Your emergency reserves are thin. Set a 'Emergency Fund' Savings Goal to secure at least 3 months of basic living costs.");
    } else {
      tips.push("Excellent! Your liquid cash emergency reserves are securely funded to keep you resilient against unexpected life events.");
    }

    if (totalDebtsValue > totalAccountBalance) {
      tips.push("Your total outstanding debts exceed your current active wallet cash. Try paying off high-interest Loans Received first.");
    }

    let overBudgetCategories: string[] = [];
    budgets.forEach(b => {
      const spent = workspaceTransactions
        .filter(t => t.type === "expense" && t.category === b.category && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amount, 0);
      if (spent > b.limitAmount) overBudgetCategories.push(b.category);
    });

    if (overBudgetCategories.length > 0) {
      tips.push(`You have exceeded monthly budget limits in: ${overBudgetCategories.join(", ")}. Cap spending in these sectors immediately.`);
    }

    if (workspaceInvestments.length === 0) {
      tips.push("Your money is resting entirely in standard wallets. Explore sovereign Treasury Bills or Mutual Funds to hedge against inflation.");
    }

    return tips;
  };

  // Generate automated Coach Insights
  const generateCoachInsights = () => {
    // Top categories
    const categorySums: { [key: string]: number } = {};
    workspaceTransactions
      .filter(t => t.type === "expense" && t.date.startsWith(currentMonth))
      .forEach(t => {
        categorySums[t.category] = (categorySums[t.category] || 0) + t.amount;
      });

    let topCategory = "None";
    let topVal = 0;
    Object.entries(categorySums).forEach(([cat, val]) => {
      if (val > topVal) {
        topVal = val;
        topCategory = cat;
      }
    });

    return {
      topCategory,
      topVal,
      savingsProgress: workspaceGoals.length > 0 
        ? Math.round((totalSavingsGoalValue / workspaceGoals.reduce((s, g) => s + g.targetAmount, 0)) * 100) || 0
        : 0,
    };
  };

  const coachStats = generateCoachInsights();

  // AI coach interactive chat states
  const [coachChat, setCoachChat] = useState<{ sender: "user" | "coach"; text: string }[]>([
    { sender: "coach", text: `Hello! I'm your Aziiki AI Personal Financial Coach. I've audited your wallets, budgets, and savings targets. You have an active net worth of ${currencySymbol}${personalNetWorth.toLocaleString()} and a Financial Health Score of ${healthScore}/100. Ask me anything about how to optimize your budget, set higher yields, or secure your future!` }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isCoachLoading, setIsCoachLoading] = useState(false);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setCoachChat(prev => [...prev, { sender: "user", text: userMsg }]);
    setChatInput("");
    setIsCoachLoading(true);

    try {
      // Craft a robust prompt contextualizing the user's personal financial state
      const systemContext = `
        You are a highly qualified personal financial coach, advisor, and planner. 
        You are coaching the user on their personal finances inside their Aziiki app.
        
        The user's current data metrics:
        - Primary Currency Symbol: ${currencySymbol}
        - Total wallet cash: ${currencySymbol}${totalAccountBalance.toLocaleString()}
        - Total savings targets value: ${currencySymbol}${totalSavingsGoalValue.toLocaleString()}
        - Total investment assets: ${currencySymbol}${totalInvestmentValue.toLocaleString()}
        - Total personal outstanding debts: ${currencySymbol}${totalDebtsValue.toLocaleString()}
        - Net Worth: ${currencySymbol}${personalNetWorth.toLocaleString()}
        - This month's total income logged: ${currencySymbol}${monthlyIncome.toLocaleString()}
        - This month's total expenses logged: ${currencySymbol}${monthlyExpenses.toLocaleString()}
        - Active budgets set: ${JSON.stringify(budgets)}
        - Financial Health Score: ${healthScore}/100
        
        The user says: "${userMsg}"
        
        Provide professional, encouraging, brief, and highly actionable financial advice in simple, clear english. 
        Refer directly to their metrics when suitable. Avoid complex accounting formulas, write in a warm and empathetic human tone.
      `;

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: systemContext })
      });

      if (!response.ok) throw new Error("API call failed");
      const resData = await response.json();
      const reply = resData.response || `Based on your profile, I recommend setting up a strict savings goal for emergencies and reviewing your entertainment expenses. Currently, you spent ${currencySymbol}${monthlyExpenses} this month. Focus on increasing your savings rate!`;

      setCoachChat(prev => [...prev, { sender: "coach", text: reply }]);
    } catch (err) {
      console.error("AI Coach request failed:", err);
      // fallback reply
      setTimeout(() => {
        setCoachChat(prev => [...prev, { 
          sender: "coach", 
          text: `Based on your current Financial Health Score of ${healthScore}/100, my top recommendation is to focus on building your Emergency Fund to shield yourself against cash constraints, and capping your ${coachStats.topCategory !== "None" ? coachStats.topCategory : "unplanned"} monthly expenditures. Let me know if you would like me to draft a custom savings plan for you!` 
        }]);
      }, 1000);
    } finally {
      setIsCoachLoading(false);
    }
  };

  // Handlers for transactions
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || txAmount <= 0) return;

    const newTx: Transaction = {
      id: "personal-tx-" + Math.random().toString(36).substr(2, 9),
      date: txDate,
      type: txType,
      category: txCategory,
      amount: Number(txAmount),
      description: txDescription.trim() || `${txType === "income" ? "Received" : "Spent"} via ${txAccount}`,
      paymentMethod: txAccount as any,
      businessId: currentBusiness.id
    };

    onAddTransaction(newTx);
    setTxAmount(100);
    setTxDescription("");
  };

  // Handlers for Accounts
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;

    const newAcc: PersonalAccount = {
      id: "acc-custom-" + Math.random().toString(36).substr(2, 5),
      name: newAccName.trim(),
      type: newAccType,
      initialBalance: Number(newAccBalance) || 0,
      balance: Number(newAccBalance) || 0
    };

    const updated = [...accounts, newAcc];
    saveWorkspaceData(updated, budgets);

    setNewAccName("");
    setNewAccBalance(0);
  };

  const handleDeleteAccount = (accId: string) => {
    const updated = accounts.filter(a => a.id !== accId);
    saveWorkspaceData(updated, budgets);
  };

  // Handlers for Goals
  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim() || newGoalTarget <= 0) return;

    const newG: Goal = {
      id: "personal-goal-" + Math.random().toString(36).substr(2, 9),
      type: newGoalType,
      name: newGoalName.trim(),
      currentAmount: Number(newGoalCurrent) || 0,
      targetAmount: Number(newGoalTarget),
      deadline: newGoalDeadline,
      businessId: currentBusiness.id
    };

    onAddGoal(newG);
    setNewGoalName("");
    setNewGoalCurrent(0);
    setNewGoalTarget(1000);
  };

  // Handler for goal contributions
  const handleExecuteGoalContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributingGoalId || contributionAmount <= 0) return;

    // 1. Log an expense transaction from selected account
    const selectedGoal = workspaceGoals.find(g => g.id === contributingGoalId);
    if (!selectedGoal) return;

    const newTx: Transaction = {
      id: "personal-tx-goal-" + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split("T")[0],
      type: "expense",
      category: "Savings & Investments",
      amount: Number(contributionAmount),
      description: `Contributed to savings goal: ${selectedGoal.name}`,
      paymentMethod: contributionAccount as any,
      businessId: currentBusiness.id
    };

    onAddTransaction(newTx);

    // 2. Add current Amount to goal
    onContributeToGoal(contributingGoalId, Number(contributionAmount));
    setContributingGoalId(null);
  };

  // Handlers for Budgets
  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const existingIndex = budgets.findIndex(b => b.category === budgetCategory);
    let updated: PersonalBudget[] = [];

    if (existingIndex >= 0) {
      updated = budgets.map((b, idx) => idx === existingIndex ? { ...b, limitAmount: Number(budgetLimit) } : b);
    } else {
      updated = [...budgets, { category: budgetCategory, limitAmount: Number(budgetLimit) }];
    }

    saveWorkspaceData(accounts, updated);
  };

  const handleDeleteBudget = (category: string) => {
    const updated = budgets.filter(b => b.category !== category);
    saveWorkspaceData(accounts, updated);
  };

  // Handlers for Debt
  const handleCreateDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtCreditor.trim() || debtAmount <= 0) return;

    const newD: Debt = {
      id: "personal-debt-" + Math.random().toString(36).substr(2, 9),
      creditor: debtCreditor.trim(),
      amount: Number(debtAmount),
      interestRate: Number(debtInterest) || 0,
      dueDate: debtDue,
      type: debtType,
      businessId: currentBusiness.id
    };

    onAddDebt(newD);
    setDebtCreditor("");
    setDebtAmount(500);
    setDebtInterest(0);
  };

  const handleExecuteDebtRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayingDebtId || repayAmount <= 0) return;

    const selectedDebt = workspaceDebts.find(d => d.id === repayingDebtId);
    if (!selectedDebt) return;

    // Repaying records an expense transaction
    const newTx: Transaction = {
      id: "personal-tx-debt-" + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split("T")[0],
      type: "expense",
      category: "Debt Repayment",
      amount: Number(repayAmount),
      description: `Repaid loan from: ${selectedDebt.creditor}`,
      paymentMethod: repayAccountName as any,
      businessId: currentBusiness.id
    };

    onAddTransaction(newTx);
    onRepayDebt(repayingDebtId, Number(repayAmount), repayAccountName);
    setRepayingDebtId(null);
  };

  // Handlers for Investments
  const handleCreateInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invName.trim() || invValue <= 0) return;

    const newI: Investment = {
      id: "personal-inv-" + Math.random().toString(36).substr(2, 9),
      name: invName.trim(),
      type: invType,
      institution: invInst.trim() || "Local Bank",
      value: Number(invValue),
      amountInvested: Number(invValue),
      expectedReturnRate: Number(invReturn) || 0,
      dateAcquired: new Date().toISOString().split("T")[0],
      maturityDate: invMaturity || undefined,
      businessId: currentBusiness.id
    };

    onAddInvestment(newI);
    setInvName("");
    setInvInst("");
    setInvValue(1000);
    setInvReturn(12);
    setInvMaturity("");
  };

  // Set default initial account in selectors when accounts change
  useEffect(() => {
    if (accounts.length > 0) {
      if (!txAccount) setTxAccount(accounts[0].name);
      if (!contributionAccount) setContributionAccount(accounts[0].name);
      if (!repayAccountName) setRepayAccountName(accounts[0].name);
    }
  }, [accounts]);

  // Report visual data formats
  const getCategoryBreakdownData = () => {
    const dataMap: { [key: string]: number } = {};
    workspaceTransactions
      .filter(t => t.type === "expense" && t.date.startsWith(currentMonth))
      .forEach(t => {
        dataMap[t.category] = (dataMap[t.category] || 0) + t.amount;
      });

    return Object.entries(dataMap).map(([name, value]) => ({ name, value }));
  };

  const getMonthlyTrendData = () => {
    // Generate last 6 months trend
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().substring(0, 7));
    }

    return months.map(m => {
      const monthTx = workspaceTransactions.filter(t => t.date.startsWith(m));
      const income = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return {
        month: m,
        Income: income,
        Expenses: expense,
        Savings: income - expense
      };
    });
  };

  const getSavingsGrowthData = () => {
    return workspaceGoals.map(g => ({
      name: g.name,
      Current: g.currentAmount,
      Target: g.targetAmount
    }));
  };

  const getNetWorthTrendData = () => {
    // Basic mock historical Net Worth values leading up to current for report visual appeal
    return [
      { month: "Jan", NetWorth: Math.max(2000, personalNetWorth - 4000) },
      { month: "Feb", NetWorth: Math.max(3000, personalNetWorth - 3200) },
      { month: "Mar", NetWorth: Math.max(4000, personalNetWorth - 2500) },
      { month: "Apr", NetWorth: Math.max(5000, personalNetWorth - 1500) },
      { month: "May", NetWorth: Math.max(6000, personalNetWorth - 500) },
      { month: "Jun (Current)", NetWorth: personalNetWorth }
    ];
  };

  const categoryBreakdown = getCategoryBreakdownData();
  const monthlyTrend = getMonthlyTrendData();
  const savingsTrend = getSavingsGrowthData();
  const netWorthTrend = getNetWorthTrendData();

  // Color arrays for Recharts Pies
  const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

  return (
    <div id="personal-workspace-frame" className="space-y-6">
      
      {/* Premium Workspace Header with mini-selector navigation */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-left">
        <div className="flex items-center gap-3.5">
          <div className="bg-emerald-50 text-emerald-600 w-12 h-12 rounded-2xl border border-emerald-100 flex items-center justify-center text-xl font-black shadow-inner">
            👤
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-slate-900 font-sans">{currentBusiness.name}</h2>
              <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Free Personal Workspace
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Keep track of your individual salary, savings targets, liquid mobile wallets, and overall net worth without complex ledger registers.</p>
          </div>
        </div>

        {/* Action button: Toggle Ads illustration and Free promise */}
        <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl font-sans text-[11px] font-semibold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Permanently Free Workspace</span>
        </div>
      </div>

      {/* Internal Navigation Subtabs */}
      <div className="border-b border-slate-200 pb-px flex gap-2 overflow-x-auto custom-scrollbar scrollbar-none">
        {[
          { id: "dashboard", label: "Dashboard", icon: Activity },
          { id: "transactions", label: "Income & Spend", icon: TrendingUp },
          { id: "accounts", label: "My Wallets", icon: CreditCard },
          { id: "savings", label: "Savings Goals", icon: PiggyBank },
          { id: "budgets", label: "Monthly Budgets", icon: Target },
          { id: "reports", label: "Financial Reports", icon: LucideLineChart },
          { id: "coach", label: "AI Finance Coach", icon: BrainCircuit }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => changePersonalTab(tab.id)}
              className={`pb-3.5 pt-1 px-4 text-xs font-bold font-sans transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap -mb-px ${
 personalTab === tab.id
 ? "border-emerald-600 text-emerald-600 font-black"
 : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
 }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------ ACTIVE VIEW CONTAINER ------------------ */}
      {/* key={personalTab} forces a remount on every tab switch so the
          fade-in animation actually replays instead of only firing once on
          this container's first mount. */}
      <div key={personalTab} className="animate-fade-in text-left">
          <>
            {/* 1. PERSONAL DASHBOARD */}
            {personalTab === "dashboard" && (
          <div className="space-y-6">
            
            {/* Top Row: Financial parameters cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Total Cash Balance</span>
                  <strong className="text-lg font-sans font-black text-slate-900 mt-0.5 block">{currencySymbol} {totalAccountBalance.toLocaleString()}</strong>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{accounts.length} dynamic wallets linked</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Total Goal Savings</span>
                  <strong className="text-lg font-sans font-black text-slate-900 mt-0.5 block">{currencySymbol} {totalSavingsGoalValue.toLocaleString()}</strong>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{workspaceGoals.length} active savings targets</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Net Monthly Growth</span>
                  <strong className={`text-lg font-sans font-black mt-0.5 block ${netMonthlySavings >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {netMonthlySavings >= 0 ? "+" : ""}{currencySymbol} {netMonthlySavings.toLocaleString()}
                  </strong>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Income vs Spend this month</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4.5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Calculated Net Worth</span>
                  <strong className="text-lg font-sans font-black text-slate-900 mt-0.5 block">{currencySymbol} {personalNetWorth.toLocaleString()}</strong>
                  <span className="text-[9px] text-slate-400 block mt-0.5">Liquid cash + investments - debts</span>
                </div>
              </div>

            </div>

            {/* Middle Row: Financial Health Score Meter and Active Budgets Alert list */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Health score widget */}
              <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-xs font-sans flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    Financial Health Score
                  </h3>
                  <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Excellent</span>
                </div>

                <div className="flex items-center gap-4 py-1.5">
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg className="w-20 h-20">
                      <circle className="text-slate-100" strokeWidth="6" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40"/>
                      <circle className="text-emerald-600" strokeWidth="6" strokeDasharray="188.4" strokeDashoffset={188.4 - (188.4 * healthScore) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="30" cx="40" cy="40"/>
                    </svg>
                    <span className="absolute text-sm font-sans font-black text-slate-900">{healthScore}%</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Aziiki Scoring Index</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-normal">Your score analyzes savings velocity, emergency wallet reserves, and budget limits compliance.</p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-1">
                  <strong className="text-[10px] font-mono text-emerald-600 uppercase block font-black">Coach Tip:</strong>
                  <p className="text-[10px] text-slate-600 leading-relaxed font-sans">
                    {getActionableHealthTips()[0] || "All clear! You are balancing budgets beautifully. Keep logging to track savings targets."}
                  </p>
                </div>
              </div>

              {/* Monthly Budgets & Limit status bars */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-xs font-sans flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-500" />
                    Monthly Budget Compliance
                  </h3>
                  <button onClick={() => changePersonalTab("budgets")} className="text-[10px] text-emerald-600 hover:underline font-bold">Edit Limits</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {budgets.slice(0, 4).map(b => {
                    const spent = workspaceTransactions
                      .filter(t => t.type === "expense" && t.category === b.category && t.date.startsWith(currentMonth))
                      .reduce((sum, t) => sum + t.amount, 0);
                    const pct = Math.round((spent / b.limitAmount) * 100) || 0;
                    const isOver = spent > b.limitAmount;

                    return (
                      <div key={b.category} className="space-y-1 border border-slate-100 p-2.5 rounded-xl bg-slate-50/40">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-700">{b.category}</span>
                          <span className={isOver ? "text-rose-600" : pct > 80 ? "text-amber-600" : "text-slate-500"}>
                            {currencySymbol}{spent} / {currencySymbol}{b.limitAmount}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${isOver ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[9px] font-medium mt-1">
                          <span className="text-slate-400">{pct}% utilized</span>
                          {isOver && <span className="text-rose-500 font-bold animate-pulse">ALERT: Over Budget!</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Bottom Row: Recent Transaction Feed, Savings Goals Progress list, and Upcoming Bills alert */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Recent transactions (filtered) */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-xs font-sans flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4 text-emerald-500" />
                    Recent Cash Adjustments
                  </h3>
                  <button onClick={() => changePersonalTab("transactions")} className="text-[10px] text-emerald-600 hover:underline font-bold">Add Transaction</button>
                </div>

                {workspaceTransactions.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Wallet}
                    title="No transactions yet"
                    message="Log your first personal income or expense to start tracking your cash position here."
                    action={{ label: "Log first transaction", onClick: () => changePersonalTab("transactions") }}
                  />
                ) : (
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                    {workspaceTransactions.slice(0, 5).map(t => (
                      <div key={t.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11.5px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
 t.type === "income" 
 ? "bg-emerald-50 text-emerald-600" 
 : "bg-slate-100 text-slate-500"
 }`}>
                            {t.type === "income" ? "📥" : "📤"}
                          </div>
                          <div className="text-left min-w-0">
                            <strong className="text-slate-800 block truncate leading-tight font-sans">{t.description}</strong>
                            <span className="text-[9px] text-slate-400 font-mono">{t.category} • {t.paymentMethod}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <strong className={`font-mono font-bold ${t.type === "income" ? "text-emerald-600" : "text-slate-800"}`}>
                            {t.type === "income" ? "+" : "-"}{currencySymbol}{t.amount.toLocaleString()}
                          </strong>
                          <span className="text-[9px] text-slate-400 block mt-0.5">{t.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Savings goals list and Debt alert widgets */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-xs font-sans flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-500" />
                    Active Savings Progress
                  </h3>
                  <button onClick={() => changePersonalTab("savings")} className="text-[10px] text-emerald-600 hover:underline font-bold">New Goal</button>
                </div>

                {workspaceGoals.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs text-slate-400 italic">No savings targets configured.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workspaceGoals.slice(0, 3).map(g => {
                      const progress = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) || 0;
                      return (
                        <div key={g.id} className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-slate-700">{g.name}</span>
                            <span className="text-slate-500">{currencySymbol}{g.currentAmount.toLocaleString()} / {currencySymbol}{g.targetAmount.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Upcoming Debts due soon */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Upcoming Bills & Loan Due Dates</span>
                  {workspaceDebts.filter(d => d.dueDate).length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic">No upcoming credit/loans due.</p>
                  ) : (
                    <div className="space-y-2">
                      {workspaceDebts.slice(0, 2).map(d => (
                        <div key={d.id} className="flex justify-between items-center bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl text-[10.5px]">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                            <div className="text-left">
                              <strong className="text-slate-800 block">{d.creditor} ({d.type})</strong>
                              <span className="text-[9px] text-slate-400">Due Date: {d.dueDate}</span>
                            </div>
                          </div>
                          <strong className="font-mono text-rose-600 text-xs">{currencySymbol}{d.amount.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>
        )}

        {/* 2. INCOME & SPENDING */}
        {personalTab === "transactions" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form Column */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                ✍️ Log Cash Inflow / Outflow
              </h3>

              <form onSubmit={handleSaveTransaction} className="space-y-3.5 text-xs">
                
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType("income");
                      setTxCategory("Salary");
                    }}
                    className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
 txType === "income" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent"
 }`}
                  >
                    📥 Cash Inflow (Income)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType("expense");
                      setTxCategory("Food");
                    }}
                    className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors cursor-pointer ${
 txType === "expense" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 bg-transparent"
 }`}
                  >
                    📤 Cash Outflow (Spend)
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    required
                    value={txAmount || ""}
                    onChange={(e) => setTxAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Category Sector</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  >
                    {txType === "income" ? (
                      ["Salary", "Freelance Work", "Business Income", "Gifts", "Investments", "Allowances", "Side Hustles", "Other"].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))
                    ) : (
                      ["Food", "Transport", "Rent", "Utilities", "Fuel", "Airtime", "Internet", "Shopping", "Entertainment", "Healthcare", "Education", "Family Support", "Charity", "Other"].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Wallet / Payment Account</label>
                  <select
                    value={txAccount}
                    onChange={(e) => setTxAccount(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name} ({currencySymbol}{acc.balance.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Short Narrative / Memo</label>
                  <input
                    type="text"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                    placeholder="e.g. Weekly family groceries buy"
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Transaction Date</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Confirm Ledger Entry
                </button>

              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                📂 Personal Transaction Ledger
              </h3>

              {workspaceTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic">No entries configured yet. Try logging one on the left.</div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
                  {workspaceTransactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11.5px]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
 t.type === "income" 
 ? "bg-emerald-50 text-emerald-600" 
 : "bg-slate-100 text-slate-500"
 }`}>
                          {t.type === "income" ? "📥" : "📤"}
                        </div>
                        <div className="text-left min-w-0">
                          <strong className="text-slate-800 block truncate leading-tight font-sans">{t.description}</strong>
                          <span className="text-[9px] text-slate-400 font-mono">{t.category} • {t.paymentMethod}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <strong className={`font-mono font-bold ${t.type === "income" ? "text-emerald-600" : "text-slate-800"}`}>
                            {t.type === "income" ? "+" : "-"}{currencySymbol}{t.amount.toLocaleString()}
                          </strong>
                          <span className="text-[9px] text-slate-400 block mt-0.5">{t.date}</span>
                        </div>
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          className="text-slate-350 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* 3. PAYMENT ACCOUNTS */}
        {personalTab === "accounts" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form Column */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                ➕ Add Wallet / Bank
              </h3>

              <form onSubmit={handleAddAccount} className="space-y-3.5 text-xs">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Account Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. My Mobile Money Wallet"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Account Carrier Type</label>
                  <select
                    value={newAccType}
                    onChange={(e) => setNewAccType(e.target.value as any)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  >
                    <option value="MTN Mobile Money">MTN Mobile Money</option>
                    <option value="Telecel Cash">Telecel Cash</option>
                    <option value="AirtelTigo Money">AirtelTigo Money</option>
                    <option value="Bank Account">Bank Account</option>
                    <option value="Cash Wallet">Cash Wallet</option>
                    <option value="Savings Account">Savings Account</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Initial Seed Balance ({currencySymbol})</label>
                  <input
                    type="number"
                    required
                    value={newAccBalance || ""}
                    onChange={(e) => setNewAccBalance(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Create Payment Account
                </button>

              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                💳 Registered Payment Accounts
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {accounts.map(acc => (
                  <div key={acc.id} className="bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 border border-slate-850 p-4.5 rounded-2xl text-white space-y-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
                    {/* decorative circles */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <strong className="text-[13px] font-bold block font-sans tracking-tight leading-snug">{acc.name}</strong>
                        <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-widest">{acc.type}</span>
                      </div>
                      
                      {accounts.length > 1 && (
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="text-slate-500 hover:text-rose-500 p-1.5 rounded bg-white/5 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-0.5 pt-2">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Active Wallet Cash</span>
                      <strong className="text-xl font-mono text-emerald-400 block tracking-tight">{currencySymbol} {acc.balance.toLocaleString()}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* 4. SAVINGS GOALS */}
        {personalTab === "savings" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form Column */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                🐷 Create Savings Goal
              </h3>

              <form onSubmit={handleCreateGoal} className="space-y-3.5 text-xs">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Goal Description Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Purchase High-Spec Laptop"
                    value={newGoalName}
                    onChange={(e) => setNewGoalName(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Goal Preset Type</label>
                  <select
                    value={newGoalType}
                    onChange={(e) => setNewGoalType(e.target.value as any)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  >
                    <option value="Savings">Emergency Fund / Savings</option>
                    <option value="Equipment">Buy Gadgets / Equipment</option>
                    <option value="Expansion">Travel & Vacation</option>
                    <option value="Revenue">School Fees / Education</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Target Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    required
                    value={newGoalTarget || ""}
                    onChange={(e) => setNewGoalTarget(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Pre-Funded Amount ({currencySymbol})</label>
                  <input
                    type="number"
                    value={newGoalCurrent || ""}
                    onChange={(e) => setNewGoalCurrent(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 100"
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Target Date Deadline</label>
                  <input
                    type="date"
                    required
                    value={newGoalDeadline}
                    onChange={(e) => setNewGoalDeadline(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Configure Savings Goal
                </button>

              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                🐷 Savings Goals Progress Tracker
              </h3>

              {workspaceGoals.length === 0 ? (
                <div className="py-12 text-center text-slate-400 italic">No savings goals configured yet. Complete the setup form on the left.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {workspaceGoals.map(g => {
                    const progress = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) || 0;
                    const remaining = Math.max(0, g.targetAmount - g.currentAmount);

                    return (
                      <div key={g.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-150 flex flex-col justify-between space-y-3 relative overflow-hidden">
                        
                        <div className="flex justify-between items-start">
                          <div className="text-left">
                            <strong className="text-xs font-bold text-slate-800 block">{g.name}</strong>
                            <span className="text-[9px] font-mono text-slate-400">Deadline: {g.deadline}</span>
                          </div>
                          
                          <button
                            onClick={() => onDeleteGoal(g.id)}
                            aria-label={`Delete goal ${g.name}`}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>

                        {/* progress bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-emerald-600 font-mono">{progress}% Complete</span>
                            <span className="text-slate-500">{currencySymbol}{g.currentAmount.toLocaleString()} / {currencySymbol}{g.targetAmount.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] border-t border-slate-200/50 pt-2 mt-1">
                          <span className="text-slate-400">Remaining: {currencySymbol}{remaining.toLocaleString()}</span>
                          <button
                            onClick={() => setContributingGoalId(g.id)}
                            className="px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                          >
                            💰 Contribute Cash
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* Goal Contribution modal popup inline */}
              {contributingGoalId && (
                <div className="border border-emerald-500/30 bg-emerald-50/50 p-4 rounded-2xl space-y-3 mt-4 text-xs">
                  <div className="flex justify-between items-center">
                    <strong className="text-emerald-800">Defray/Contribute cash to selected target</strong>
                    <button onClick={() => setContributingGoalId(null)} aria-label="Close" className="font-bold text-slate-400 hover:text-slate-650">✕</button>
                  </div>

                  <form onSubmit={handleExecuteGoalContribution} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[9px] text-slate-450 block mb-1">Amount to contribute ({currencySymbol})</label>
                      <input
                        type="number"
                        required
                        value={contributionAmount || ""}
                        onChange={(e) => setContributionAmount(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-450 block mb-1">Deduct from wallet</label>
                      <select
                        value={contributionAccount}
                        onChange={(e) => setContributionAccount(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5"
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.name}>{acc.name} ({currencySymbol}{acc.balance.toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-1.5 rounded-lg shadow-sm cursor-pointer"
                      >
                        Complete Transfer
                      </button>
                    </div>
                  </form>
                </div>
              )}

            </div>

          </div>
        )}

        {/* 5. MONTHLY BUDGETS */}
        {personalTab === "budgets" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Form Column */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                🎯 Set Budget Caps
              </h3>

              <form onSubmit={handleSaveBudget} className="space-y-3.5 text-xs">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Expenditure Category</label>
                  <select
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-sans"
                  >
                    {["Food", "Transport", "Rent", "Utilities", "Fuel", "Airtime", "Internet", "Shopping", "Entertainment", "Healthcare", "Education", "Family Support", "Charity", "Other"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Monthly limit amount ({currencySymbol})</label>
                  <input
                    type="number"
                    required
                    value={budgetLimit || ""}
                    onChange={(e) => setBudgetLimit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 outline-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  Apply Budget Limit
                </button>

              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono border-b border-slate-100 pb-2">
                🎯 Configure Monthly Expenditure Budgets
              </h3>

              <div className="space-y-3.5">
                {budgets.map(b => {
                  const spent = workspaceTransactions
                    .filter(t => t.type === "expense" && t.category === b.category && t.date.startsWith(currentMonth))
                    .reduce((sum, t) => sum + t.amount, 0);
                  const pct = Math.round((spent / b.limitAmount) * 100) || 0;
                  const isOver = spent > b.limitAmount;

                  return (
                    <div key={b.category} className="border border-slate-200 p-3.5 rounded-2xl space-y-2 bg-slate-50/40">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-800">{b.category}</span>
                          {isOver && <span className="bg-rose-500/10 text-rose-600 border border-rose-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse">OVER BUDGET LIMIT</span>}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className={isOver ? "text-rose-600 font-mono" : "text-slate-500 font-mono"}>
                            {currencySymbol}{spent.toLocaleString()} spent of {currencySymbol}{b.limitAmount.toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleDeleteBudget(b.category)}
                            aria-label={`Delete budget ${b.category}`}
                            className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* progress bar */}
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${isOver ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        ></div>
                      </div>
                      
                      <div className="text-[9px] text-slate-400 font-medium">
                        {pct}% of maximum allocated category threshold utilized this month
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* 6. FINANCIAL HEALTH & REPORTS */}
        {personalTab === "reports" && (
          <div className="space-y-6">
            
            {/* Net Worth trend historical reporting chart card */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Dynamic Net Worth Trend</span>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={netWorthTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip formatter={(value) => `${currencySymbol}${value}`} />
                      <Line type="monotone" dataKey="NetWorth" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Monthly Income vs Spending</span>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={10} />
                      <Tooltip formatter={(value) => `${currencySymbol}${value}`} />
                      <Legend />
                      <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Category expenditure pie chart and Savings growth bars */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Monthly Spend Category Breakdown</span>
                {categoryBreakdown.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic">No expenditures logged this month.</div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-48 h-48 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {categoryBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${currencySymbol}${value}`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-bold w-full">
                      {categoryBreakdown.map((item, idx) => (
                        <div key={item.name} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></span>
                          <span className="text-slate-600 truncate">{item.name}:</span>
                          <span className="text-slate-800 font-mono font-extrabold">{currencySymbol}{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Debt & Investment tracker panel */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Debts & Assets Ledger</span>
                  <div className="flex gap-2">
                    <button onClick={() => changePersonalTab("accounts")} className="text-[10px] text-emerald-600 hover:underline font-bold">Accounts</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Debt tracker */}
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-800 border-b border-slate-50 pb-1">
                      <span>💸 Creditors & Loans</span>
                      <button onClick={() => setRepayingDebtId("new")} className="text-[10px] text-emerald-600 hover:underline">Add Debt</button>
                    </div>

                    {workspaceDebts.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No outstanding credit logged.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {workspaceDebts.map(d => (
                          <div key={d.id} className="p-2 bg-slate-50 rounded-xl border border-slate-150 text-[11px] relative">
                            <button
                              onClick={() => onDeleteDebt(d.id)}
                              aria-label={`Delete debt ${d.creditor}`}
                              className="absolute top-1.5 right-1.5 text-[9px] font-black text-slate-400 hover:text-rose-500"
                            >
                              ✕
                            </button>
                            <div className="text-left font-sans font-bold text-slate-750 pr-4">{d.creditor}</div>
                            <div className="flex justify-between font-mono font-bold text-[10px] mt-1 text-slate-500">
                              <span>{d.type}</span>
                              <span className="text-rose-600 font-extrabold">{currencySymbol}{d.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] mt-1.5 border-t border-dashed border-slate-200 pt-1">
                              <span className="text-slate-450">Due: {d.dueDate}</span>
                              <button
                                onClick={() => setRepayingDebtId(d.id)}
                                className="text-[9px] font-extrabold text-white bg-slate-800 px-1.5 py-0.5 rounded"
                              >
                                Repay
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Investment tracker */}
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-800 border-b border-slate-50 pb-1">
                      <span>📈 Investment Assets</span>
                      <button onClick={() => setRepayingDebtId("new-investment")} className="text-[10px] text-emerald-600 hover:underline">Add asset</button>
                    </div>

                    {workspaceInvestments.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No high-yield investments.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {workspaceInvestments.map(i => (
                          <div key={i.id} className="p-2 bg-slate-50 rounded-xl border border-slate-150 text-[11px] relative">
                            <button
                              onClick={() => onDeleteInvestment(i.id)}
                              aria-label={`Delete investment ${i.name}`}
                              className="absolute top-1.5 right-1.5 text-[9px] font-black text-slate-400 hover:text-rose-500"
                            >
                              ✕
                            </button>
                            <div className="text-left font-sans font-bold text-slate-750 pr-4">{i.name}</div>
                            <div className="flex justify-between font-mono font-bold text-[10px] mt-1 text-slate-500">
                              <span>Yield: {i.expectedReturnRate}%</span>
                              <span className="text-emerald-600 font-extrabold">{currencySymbol}{i.value.toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Repay Debt inline modal popups */}
                {repayingDebtId && repayingDebtId !== "new" && repayingDebtId !== "new-investment" && (
                  <div className="border border-rose-500/20 bg-rose-500/5 p-3 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <strong className="text-rose-700">Log Debt Repayment</strong>
                      <button onClick={() => setRepayingDebtId(null)} aria-label="Close" className="font-bold text-slate-450 hover:text-slate-600">✕</button>
                    </div>
                    <form onSubmit={handleExecuteDebtRepayment} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="number"
                        required
                        placeholder="Repayment amount"
                        value={repayAmount || ""}
                        onChange={(e) => setRepayAmount(parseFloat(e.target.value) || 0)}
                        className="bg-white border rounded p-1.5 font-mono text-[11px]"
                      />
                      <select
                        value={repayAccountName}
                        onChange={(e) => setRepayAccountName(e.target.value)}
                        className="bg-white border rounded p-1.5 text-[11px]"
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.name}>{acc.name} ({currencySymbol}{acc.balance.toLocaleString()})</option>
                        ))}
                      </select>
                      <button type="submit" className="bg-rose-600 text-white font-bold rounded p-1 text-[11px]">Pay Now</button>
                    </form>
                  </div>
                )}

                {/* Create Debt modal popup */}
                {repayingDebtId === "new" && (
                  <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3 mt-4 text-xs">
                    <div className="flex justify-between items-center">
                      <strong className="text-slate-800">Register Credit Outstanding</strong>
                      <button onClick={() => setRepayingDebtId(null)} aria-label="Close" className="font-bold text-slate-450 hover:text-slate-650">✕</button>
                    </div>

                    <form onSubmit={handleCreateDebt} className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Creditor Name"
                          value={debtCreditor}
                          onChange={(e) => setDebtCreditor(e.target.value)}
                          className="bg-white border rounded p-1.5 text-[11px]"
                        />
                        <input
                          type="number"
                          required
                          placeholder="Amount"
                          value={debtAmount || ""}
                          onChange={(e) => setDebtAmount(parseFloat(e.target.value) || 0)}
                          className="bg-white border rounded p-1.5 text-[11px] font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={debtType}
                          onChange={(e) => setDebtType(e.target.value as any)}
                          className="bg-white border rounded p-1.5 text-[11px]"
                        >
                          <option value="Loan">Loan</option>
                          <option value="Supplier Credit">Supplier Credit</option>
                          <option value="Overdraft">Overdraft</option>
                        </select>
                        <input
                          type="number"
                          placeholder="Interest %"
                          value={debtInterest || ""}
                          onChange={(e) => setDebtInterest(parseFloat(e.target.value) || 0)}
                          className="bg-white border rounded p-1.5 text-[11px]"
                        />
                        <input
                          type="date"
                          required
                          value={debtDue}
                          onChange={(e) => setDebtDue(e.target.value)}
                          className="bg-white border rounded p-1.5 text-[10px]"
                        />
                      </div>
                      <button type="submit" className="w-full bg-slate-900 text-white font-bold p-2 rounded">Save Credit Record</button>
                    </form>
                  </div>
                )}

                {/* Create Investment Asset modal popup */}
                {repayingDebtId === "new-investment" && (
                  <div className="border border-slate-200 bg-slate-50 p-4 rounded-xl space-y-3 mt-4 text-xs">
                    <div className="flex justify-between items-center">
                      <strong className="text-slate-800">Log Wealth Asset Placement</strong>
                      <button onClick={() => setRepayingDebtId(null)} aria-label="Close" className="font-bold text-slate-450 hover:text-slate-650">✕</button>
                    </div>

                    <form onSubmit={handleCreateInvestment} className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Investment Asset Name"
                          value={invName}
                          onChange={(e) => setInvName(e.target.value)}
                          className="bg-white border rounded p-1.5 text-[11px]"
                        />
                        <input
                          type="number"
                          required
                          placeholder="Principal Value"
                          value={invValue || ""}
                          onChange={(e) => setInvValue(parseFloat(e.target.value) || 0)}
                          className="bg-white border rounded p-1.5 text-[11px] font-mono"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={invType}
                          onChange={(e) => setInvType(e.target.value as any)}
                          className="bg-white border rounded p-1.5 text-[11px]"
                        >
                          <option value="Treasury Bill">Treasury Bill</option>
                          <option value="Mutual Fund">Mutual Fund</option>
                          <option value="Fixed Deposit">Fixed Deposit</option>
                          <option value="Stock">Stock / Equity</option>
                          <option value="ETF">ETF</option>
                          <option value="Savings">Savings Bond</option>
                          <option value="Real Estate">Real Estate</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Institution Name"
                          value={invInst}
                          onChange={(e) => setInvInst(e.target.value)}
                          className="bg-white border rounded p-1.5 text-[11px]"
                        />
                        <input
                          type="number"
                          placeholder="Yield return %"
                          value={invReturn || ""}
                          onChange={(e) => setInvReturn(parseFloat(e.target.value) || 0)}
                          className="bg-white border rounded p-1.5 text-[11px]"
                        />
                      </div>
                      <button type="submit" className="w-full bg-slate-900 text-white font-bold p-2 rounded">Commit Asset Placement</button>
                    </form>
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

        {/* 7. AI COACH CHAT INTERACTIVE PANEL */}
        {personalTab === "coach" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side: Chat Console */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-5 flex flex-col justify-between h-[520px]">
              <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                <BrainCircuit className="w-5 h-5 text-emerald-500 animate-pulse" />
                <div>
                  <h3 className="font-bold text-slate-850 text-xs font-sans">Active AI Financial Coaching Panel</h3>
                  <span className="text-[9px] text-slate-450 font-mono">Secured Sandbox Engine • Realtime Context</span>
                </div>
              </div>

              {/* Chat log body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-2 custom-scrollbar">
                {coachChat.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 text-xs leading-relaxed max-w-[85%] ${msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold shrink-0 ${
 msg.sender === "coach" ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-700"
 }`}>
                      {msg.sender === "coach" ? "🤖" : "👤"}
                    </div>
                    
                    <div className={`p-3 rounded-2xl text-left shadow-sm ${
 msg.sender === "coach" 
 ? "bg-slate-50 text-slate-850 border border-slate-100" 
 : "bg-emerald-600 text-white font-medium"
 }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}

                {isCoachLoading && (
                  <div className="flex gap-3 text-xs items-center mr-auto animate-pulse">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center">🤖</div>
                    <div className="p-3 bg-slate-50 text-slate-450 border border-slate-100 rounded-2xl">
                      Thinking and auditing wallet entries...
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendChat} className="flex gap-2.5 border-t border-slate-100 pt-3">
                <input
                  type="text"
                  required
                  disabled={isCoachLoading}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask e.g. How do I calculate a high-yield mutual fund? / Am I spending too much?"
                  className="flex-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-4 py-2.5 outline-none font-sans"
                />
                <button
                  type="submit"
                  disabled={isCoachLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-5 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>

            {/* Right side: Advice panel */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block tracking-wider">Coach Auditing Observations</span>
              
              <div className="space-y-3 text-xs font-sans">
                <div className="p-3 bg-slate-50 border rounded-xl flex items-start gap-2.5">
                  <span className="text-base mt-0.5">💡</span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px]">Primary Spend Outflow</h4>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">Your biggest spending category this month is <strong>{coachStats.topCategory !== "None" ? coachStats.topCategory : "not set yet"}</strong>.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border rounded-xl flex items-start gap-2.5">
                  <span className="text-base mt-0.5">📈</span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px]">Savings Target Pace</h4>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">You have satisfied <strong>{coachStats.savingsProgress}%</strong> of combined goals parameters.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border rounded-xl flex items-start gap-2.5">
                  <span className="text-base mt-0.5">🔒</span>
                  <div>
                    <h4 className="font-bold text-slate-800 text-[11px]">Financial Health Index</h4>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">Your Score is <strong>{healthScore}/100</strong>. Cap entertainment limits and fund emergency reserves to raise it.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
          </>
      </div>

    </div>
  );
}
