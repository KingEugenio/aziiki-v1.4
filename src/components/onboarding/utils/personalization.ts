// Pure, side-effect-free personalization logic for the onboarding flow.
// Every function here just maps the user's Phase 1 answers to copy/sample
// data - no state, no API calls - so Phase2Aha and Phase3Commit can stay
// dumb render layers that simply call these.

export type BusinessType = "retail" | "freelancer" | "food_beverage" | "other";
export type RevenueBracket = "starting" | "small" | "growing" | "established";
export type Challenge = "late_payments" | "cash_flow" | "expenses" | "margins";

export interface OnboardingAnswers {
  businessType?: BusinessType;
  revenue?: RevenueBracket;
  challenge?: Challenge;
}

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string; emoji: string }[] = [
  { value: "retail", label: "Retail / Shop", emoji: "🛒" },
  { value: "freelancer", label: "Freelancer / Services", emoji: "💼" },
  { value: "food_beverage", label: "Food & Beverage", emoji: "🍲" },
  { value: "other", label: "Something else", emoji: "✨" },
];

export const REVENUE_OPTIONS: { value: RevenueBracket; label: string }[] = [
  { value: "starting", label: "Just starting out" },
  { value: "small", label: "GHS 1,000 - 5,000 / month" },
  { value: "growing", label: "GHS 5,000 - 20,000 / month" },
  { value: "established", label: "GHS 20,000+ / month" },
];

export const CHALLENGE_OPTIONS: { value: Challenge; label: string; emoji: string }[] = [
  { value: "late_payments", label: "Chasing late payments", emoji: "⏰" },
  { value: "cash_flow", label: "Managing cash flow", emoji: "🌊" },
  { value: "expenses", label: "Tracking expenses", emoji: "🧾" },
  { value: "margins", label: "Growing profit margins", emoji: "📈" },
];

/** Scales sample numbers in the Aha moment so they feel like THIS user's
 * business, not a generic demo, based on the revenue bracket they picked. */
const REVENUE_MULTIPLIER: Record<RevenueBracket, number> = {
  starting: 0.4,
  small: 1,
  growing: 3.5,
  established: 9,
};

export function getRevenueMultiplier(bracket?: RevenueBracket): number {
  return bracket ? REVENUE_MULTIPLIER[bracket] : 1;
}

function scale(base: number, multiplier: number, step = 1): number {
  return Math.max(step, Math.round((base * multiplier) / step) * step);
}

export interface AhaStat {
  label: string;
  value: string;
  tone: "positive" | "negative" | "warning" | "neutral";
}

export interface AhaContent {
  eyebrow: string;
  headline: string;
  subheadline: string;
  stats: AhaStat[];
  detailTitle: string;
  detailRows: { left: string; right: string; emphasis?: boolean }[];
  tip: string;
}

const CHALLENGE_LABEL: Record<Challenge, string> = {
  late_payments: "chasing late payments",
  cash_flow: "managing cash flow",
  expenses: "tracking expenses",
  margins: "growing profit margins",
};

/** The Phase 2 "Aha moment" content - the single most important function in
 * this file. Must feel like a real, tiny win using the user's own answers,
 * never a generic feature tour. */
export function getAhaContent(answers: OnboardingAnswers): AhaContent {
  const multiplier = getRevenueMultiplier(answers.revenue);
  const challengeNote = answers.challenge
    ? ` You told us ${CHALLENGE_LABEL[answers.challenge]} is your biggest headache - this is exactly where Aziiki starts.`
    : "";

  switch (answers.businessType) {
    case "retail": {
      const revenue = scale(8500, multiplier, 50);
      const cost = scale(5200, multiplier, 50);
      const profit = revenue - cost;
      return {
        eyebrow: "Your profit, calculated instantly",
        headline: "Here's your profit calculation",
        subheadline: `Log your sales and stock once, and Aziiki does this math for you every single day.${challengeNote}`,
        stats: [
          { label: "Revenue this week", value: `GHS ${revenue.toLocaleString()}`, tone: "neutral" },
          { label: "Cost of goods", value: `GHS ${cost.toLocaleString()}`, tone: "neutral" },
          { label: "Your real profit", value: `GHS ${profit.toLocaleString()}`, tone: "positive" },
        ],
        detailTitle: "Inventory alert",
        detailRows: [
          { left: "SanDisk 128GB SD Cards", right: `${scale(3, 1 / multiplier)} left - reorder soon`, emphasis: true },
          { left: "AA NiMH Battery Packs", right: "Stock healthy" },
        ],
        tip: "Aziiki flags low stock automatically so you never turn away a sale.",
      };
    }
    case "freelancer": {
      const owed = scale(4200, multiplier, 50);
      return {
        eyebrow: "Never lose track of who owes you",
        headline: "Here's who owes you money",
        subheadline: `Every invoice you send is tracked automatically, so nothing slips through the cracks.${challengeNote}`,
        stats: [
          { label: "Outstanding invoices", value: "3", tone: "warning" },
          { label: "Total owed to you", value: `GHS ${owed.toLocaleString()}`, tone: "positive" },
          { label: "Oldest overdue by", value: "12 days", tone: "negative" },
        ],
        detailTitle: "Who owes you",
        detailRows: [
          { left: "Naa Darko Corp - INV-2026102", right: `GHS ${scale(2200, multiplier, 25)}`, emphasis: true },
          { left: "Yaw Mensah - INV-2026101", right: `GHS ${scale(1500, multiplier, 25)}` },
        ],
        tip: "One tap sends a friendly payment reminder for anything overdue.",
      };
    }
    case "food_beverage": {
      const sellPrice = scale(45, multiplier, 1);
      const cost = Math.round(sellPrice * 0.42);
      const marginPct = Math.round(((sellPrice - cost) / sellPrice) * 100);
      return {
        eyebrow: "Know your real margin, per plate",
        headline: "Here's your margin breakdown",
        subheadline: `Aziiki breaks down cost vs. price on every item you sell, so pricing is never a guess.${challengeNote}`,
        stats: [
          { label: "Selling price", value: `GHS ${sellPrice}`, tone: "neutral" },
          { label: "Ingredient cost", value: `GHS ${cost}`, tone: "neutral" },
          { label: "Margin", value: `${marginPct}%`, tone: marginPct >= 45 ? "positive" : "warning" },
        ],
        detailTitle: "Cost optimization tip",
        detailRows: [
          { left: "Cooking oil supplier price", right: "+8% this month", emphasis: true },
          { left: "Suggested action", right: "Switch to Kumasi Energy Port" },
        ],
        tip: "Aziiki flags rising ingredient costs before they quietly eat your margin.",
      };
    }
    default: {
      const income = scale(6800, multiplier, 50);
      const expenses = scale(4100, multiplier, 50);
      return {
        eyebrow: "Your business, at a glance",
        headline: "Here's your financial snapshot",
        subheadline: `This is what your dashboard looks like the moment you start logging transactions.${challengeNote}`,
        stats: [
          { label: "Income this month", value: `GHS ${income.toLocaleString()}`, tone: "positive" },
          { label: "Expenses this month", value: `GHS ${expenses.toLocaleString()}`, tone: "neutral" },
          { label: "Net position", value: `GHS ${(income - expenses).toLocaleString()}`, tone: "positive" },
        ],
        detailTitle: "Quick win",
        detailRows: [
          { left: "Biggest expense category", right: "Operations Cost", emphasis: true },
          { left: "Suggested action", right: "Set a monthly budget cap" },
        ],
        tip: "Aziiki turns raw transactions into decisions you can act on today.",
      };
    }
  }
}

export interface PaywallContent {
  headline: string;
  goalCallout: string;
  benefits: string[];
  ctaLabel: string;
}

/** Phase 3's soft paywall - benefits framed around the goal/challenge the
 * user already told us about, so it reads as a plan, not a toll booth. */
export function getPaywallContent(answers: OnboardingAnswers): PaywallContent {
  switch (answers.businessType) {
    case "retail":
      return {
        headline: "Never run out of stock again",
        goalCallout: "Built around your goal: staying stocked and profitable.",
        benefits: [
          "Automatic low-stock alerts before you lose a sale",
          "Real-time profit tracking on every transaction",
          "Unlimited inventory items and suppliers",
        ],
        ctaLabel: "Start free trial",
      };
    case "freelancer":
      return {
        headline: "Get paid 3x faster with payment reminders",
        goalCallout: "Built around your goal: getting paid on time, every time.",
        benefits: [
          "Automatic reminders for overdue invoices",
          "Unlimited invoices, quotations and receipts",
          "One-tap PDF sharing on WhatsApp",
        ],
        ctaLabel: "Start free trial",
      };
    case "food_beverage":
      return {
        headline: "Save GHS 500+/month on food costs",
        goalCallout: "Built around your goal: protecting your margins.",
        benefits: [
          "Cost-per-item breakdowns that catch price creep early",
          "Supplier price change alerts",
          "Margin reports across your whole menu",
        ],
        ctaLabel: "Start free trial",
      };
    default:
      return {
        headline: "Everything you need to run your business",
        goalCallout: "Built around your goal: total financial clarity.",
        benefits: [
          "Unlimited transactions, invoices and reports",
          "AI-powered financial insights",
          "Multi-business support as you grow",
        ],
        ctaLabel: "Start free trial",
      };
  }
}
