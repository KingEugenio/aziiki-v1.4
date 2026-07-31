import { Router, type Request, type Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "../env";

export const geminiRouter = Router();

function requireGeminiKey(res: Response): string | null {
  if (!env.GEMINI_API_KEY) {
    res.status(503).json({ error: "AI features are not configured on this server (GEMINI_API_KEY is not set)." });
    return null;
  }
  return env.GEMINI_API_KEY;
}

function stripJsonFence(text: string): string {
  let out = text.trim();
  if (out.startsWith("```json")) out = out.slice(7);
  if (out.startsWith("```")) out = out.slice(3);
  if (out.endsWith("```")) out = out.slice(0, -3);
  return out.trim();
}

const insightsSchema = z.object({
  businessName: z.string().trim().max(200).default("General SME"),
  currency: z.string().trim().max(10).default("GHS"),
  totalRevenue: z.number().finite().default(0),
  totalExpenses: z.number().finite().default(0),
  netProfit: z.number().finite().default(0),
  outstandingInvoices: z.number().finite().default(0),
  savings: z.number().finite().default(0),
  investments: z.number().finite().default(0),
  userQuery: z.string().trim().max(2000).default(""),
  recentTransactions: z.array(z.record(z.string(), z.unknown())).max(50).default([]),
});

geminiRouter.post("/insights", async (req: Request, res: Response) => {
  const apiKey = requireGeminiKey(res);
  if (!apiKey) return;

  const parsed = insightsSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const {
    businessName,
    currency,
    totalRevenue,
    totalExpenses,
    netProfit,
    outstandingInvoices,
    savings,
    investments,
    userQuery,
    recentTransactions,
  } = parsed.data;

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

    const prompt = `
        You are Aziiki AI, a seasoned enterprise finance director, fintech strategist, and SME optimization expert specifically focused on the African macroeconomic and local business landscape.

        You also act as the ultimate product helper-guide for the Aziiki web platform. Teach the user how to use the specific modules present in this application:
        - **Scorecard (Daily Ledger Cashbook & SMS Parser)**: Users can record transactions manually. They can also copy-paste raw Mobile Money or bank SMS receipts directly into the "M-Money SMS Parser" text arena to instantly extract and record the exact amount, transaction ID, date, income/expense classification, and category automatically! Custom data can be exported and imported as JSON/CSV backups here.
        - **Billing & PDFs (Invoices, Receipts, & Quotations)**: Users can create custom financial documents. Explain that users can expand the "Edit Issuer Brand Info" section to replace our pre-populated example details ("Kofi Media Services", etc.) with their own real company name, industry description, logo emoji, and WhatsApp contacts! This updates the PDF printout template immediately. They can also choose unlisted custom clients or standard CRM connections.
        - **Customer CRM**: Users can organize trade partners, log special customer notes, and track outstanding loyalty accounts.
        - **Wealth & Sovereign Treasuries**: Let users log real-world investment assets, calculate net worth, and use the "Live Investment Indices Sourcing Desk" which uses real-world Google search grounding to fetch the absolute latest T-Bill and inflation interest rates directly from Bank of Ghana, Central Bank of Nigeria, or Central Bank of Kenya depending on GHS, NGN, or KES currency!
        - **Inventory Manager**: Keep track of unit cost multipliers, stock count thresholds, and auto-flag running low-alerts.

        Analyze the following real financial state of the user's business and provide professional, actionable, realistic advice:

        --- BUSINESS INFORMATION ---
        Business name: ${businessName}
        Active currency: ${currency} (Local currency for calculations)
        Total recorded revenue: ${currency} ${totalRevenue}
        Total recorded expenses: ${currency} ${totalExpenses}
        Net profit: ${currency} ${netProfit}
        Outstanding invoices (pending collection): ${currency} ${outstandingInvoices}
        Current business savings: ${currency} ${savings}
        Current business investment portfolio: ${currency} ${investments}

        Recent raw transactions:
        ${JSON.stringify(recentTransactions.slice(0, 5), null, 2)}

        User specific query or request: "${userQuery || "Please analyze my business health and provide strategic recommendations."}"

        Provide your strategic financial planning and advisory output in a structured, inspiring, and professional tone. Keep advice focused on concrete steps the entrepreneur can take (e.g. invoice collection hacks, expense optimization, MoMo float management, GHS T-Bills or local high-yield savings allocation).
        If the user's query asks about how the app works, where to find things, how to set up their custom company/brand names, or typical features, answer clearly and friendly in the "aiReply" key.
        Return a valid JSON object structure with the following keys for native rendering in the application:
        - "healthSummary": Broad high-level summary of their financial health (1 sentence)
        - "kpiRatings": { "cashflow": string, "profitability": string, "efficiency": string }
        - "metricsAnalysis": Array of objects containing: { "title": string, "value": string, "indicator": "positive" | "negative" | "warning", "description": string }
        - "warningFlash": (string warning)
        - "localMarketHacks": Array of 3 strategic recommendations tailored for the African market.
        - "forecasting": { "month1": string, "month2": string, "month3": string, "textDescription": string }
        - "aiReply": A written personalized friendly consultant reply responding specifically to the user's query block (2-3 structured paragraphs).
      `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.7 },
    });

    const parsedInsights = JSON.parse(stripJsonFence(response.text || "{}"));
    res.json(parsedInsights);
  } catch (err: any) {
    console.error("Gemini insights error:", err);
    res.status(502).json({ error: "Failed to generate AI insights right now. Please try again shortly." });
  }
});

const chatSchema = z.object({
  message: z.string().trim().min(1).max(6000),
});

// Backs the Personal Workspace's AI coach chat, which previously called this
// exact path but the route didn't exist on the server at all.
geminiRouter.post("/chat", async (req: Request, res: Response) => {
  const apiKey = requireGeminiKey(res);
  if (!apiKey) return;

  const parsed = chatSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: parsed.data.message,
      config: { temperature: 0.6 },
    });
    res.json({ response: response.text || "" });
  } catch (err: any) {
    console.error("Gemini chat error:", err);
    res.status(502).json({ error: "Failed to reach the AI coach right now. Please try again shortly." });
  }
});

const liveInvestmentsSchema = z.object({
  currency: z.string().trim().max(10).default("GHS"),
});

const FALLBACKS: Record<string, { rates: unknown[]; inflation: string; source: string; advisory: string }> = {
  USD: {
    rates: [
      { asset: "US 3-Month Treasury Bill", rate: "5.12%", trend: "flat", safety: "Risk-Free Sovereign", source: "US Treasury" },
      { asset: "S&P 500 Stock Market Index", rate: "+15.2% YTD", trend: "up", safety: "Market Equity Risk", source: "Wall Street / NYSE" },
      { asset: "High-Yield Savings / MMF", rate: "4.45%", trend: "flat", safety: "High (FDIC Insured)", source: "SME Checking" },
      { asset: "NASDAQ Stock Index", rate: "+18.9% YTD", trend: "up", safety: "Market Equity Risk", source: "NASDAQ Exchange" },
    ],
    inflation: "3.1%",
    source: "US Federal Reserve & Wall Street Index (Estimated Fallback)",
    advisory: "Steady economic trends present strong public market growth.",
  },
  CAD: {
    rates: [
      { asset: "Canada 3-Month T-Bill", rate: "4.70%", trend: "down", safety: "Risk-Free Sovereign", source: "Bank of Canada" },
      { asset: "S&P/TSX Composite Stock Index", rate: "+9.8% YTD", trend: "up", safety: "Market Equity Risk", source: "Toronto Stock Exchange" },
      { asset: "High-Interest Savings Account (HISA)", rate: "3.95%", trend: "flat", safety: "High (CDIC Insured)", source: "Canadian Banks" },
      { asset: "TSX Blue-Chip Dividend Stocks", rate: "5.5% (yield)", trend: "flat", safety: "Medium-High Risk", source: "Dividend Portfolios" },
    ],
    inflation: "2.6%",
    source: "Bank of Canada & Toronto Stock Exchange (Estimated Fallback)",
    advisory: "Stable inflation and lower policy rates support equity capitalizations.",
  },
  NGN: {
    rates: [
      { asset: "Nigeria 90-Day NTB (T-Bill)", rate: "16.8%", trend: "up", safety: "Risk-Free Sovereign", source: "Central Bank of Nigeria" },
      { asset: "NGX All-Share Stock Index", rate: "+27.5% YTD", trend: "up", safety: "Market Equity Risk", source: "Nigerian Exchange Group" },
      { asset: "Commercial Term Deposits", rate: "14.5%", trend: "flat", safety: "High (NDIC Shielded)", source: "Tier-1 Commercial Banks" },
      { asset: "Coronation Premium Mutual Fund", rate: "17.0%", trend: "up", safety: "Medium-High Risk", source: "Asset Management" },
    ],
    inflation: "32.1%",
    source: "Central Bank of Nigeria & NGX Stock Exchange (Estimated Fallback)",
    advisory: "Strong local inflation highlights the premium of real high-growth assets.",
  },
  KES: {
    rates: [
      { asset: "Kenya 91-Day Sovereign T-Bill", rate: "15.85%", trend: "up", safety: "Risk-Free Sovereign", source: "Central Bank of Kenya" },
      { asset: "NSE 20 Stock Indices", rate: "+11.2% YTD", trend: "up", safety: "Market Equity Risk", source: "Nairobi Securities Exchange" },
      { asset: "Local Money Market Fund (MMF)", rate: "14.2%", trend: "flat", safety: "High", source: "Telco Trust Pool" },
      { asset: "NSE All-Share Index (NASI)", rate: "+8.5% YTD", trend: "up", safety: "Market Equity Risk", source: "Nairobi Securities Exchange" },
    ],
    inflation: "5.6%",
    source: "Central Bank of Kenya & Nairobi Securities Exchange (Estimated Fallback)",
    advisory: "Kenya's money market registers remarkable interest yield options.",
  },
  GHS: {
    rates: [
      { asset: "91-Day Government T-Bill", rate: "24.2%", trend: "up", safety: "Risk-Free Sovereign", source: "Bank of Ghana" },
      { asset: "GSE Composite Stocks Index", rate: "+19.5% YTD", trend: "up", safety: "Market Equity Risk", source: "Ghana Stock Exchange" },
      { asset: "Corporate Fixed Deposits", rate: "18.5%", trend: "flat", safety: "High (Commercial Bank)", source: "SME Treasury" },
      { asset: "Equity Growth Mutual Fund", rate: "15.0%", trend: "up", safety: "Medium-High Risk", source: "SME Fund Desk" },
    ],
    inflation: "22.8%",
    source: "Bank of Ghana & Ghana Stock Exchange (Estimated Fallback)",
    advisory: "Inflation limits operational margins. Maintain standard reserves in secure 91-day sovereign treasuries.",
  },
};

geminiRouter.post("/live-investments", async (req: Request, res: Response) => {
  const parsed = liveInvestmentsSchema.safeParse(req.body ?? {});
  const currency = parsed.success ? parsed.data.currency : "GHS";
  const apiKey = env.GEMINI_API_KEY;

  const respondWithFallback = () => {
    const fallback = FALLBACKS[currency] ?? FALLBACKS.GHS;
    res.json({
      sourceName: fallback.source,
      localInflation: fallback.inflation,
      rates: fallback.rates,
      lastChecked: "June 2026",
      marketAdvisory: fallback.advisory,
    });
  };

  if (!apiKey) {
    respondWithFallback();
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

    const sysPrompt = `
        You are an elite research analyst specializing in global asset management, sovereign treasuries, and public stock exchange indices as of mid-2026.
        Your task is to search real-time global and local financial indices online (using Google Search) to find the absolute LATEST yield figures, year-over-year inflation rates, central bank monetary policy interest rates, and major public stock indices performance corresponding to the user's base currency: ${currency}.

        Identify the target country corresponding to the currency:
        - USD: United States (latest US Federal Reserve policy rates, US Treasury Bills yields, and stock market indices like S&P 500, NASDAQ, or Dow Jones)
        - CAD: Canada (latest Bank of Canada policy rates, Canadian Treasury Bills, and stock market indices like S&P/TSX Composite Index)
        - GHS: Ghana (latest Bank of Ghana policy rates, GoG 91-Day & 182-Day treasury bill yields, and GSE Composite Stock Index)
        - NGN: Nigeria (latest Central Bank of Nigeria policy rates, Nigerian Treasury Bills, and Nigerian Exchange Group - NGX All-Share / 30 Index)
        - KES: Kenya (latest Central Bank of Kenya treasury bill yields, and NSE All-Share / NSE 20 Index)
        - EUR: Eurozone (latest ECB interest rates, German Bund yields, and STOXX Europe 600 stock index)
        - GBP: United Kingdom (latest Bank of England base rates, UK Government Gilt/T-bill yields, and FTSE 100 stock index)
        - Other currencies: Map to their respective country's central bank and primary stock exchange.

        You MUST include a mix of BOTH Risk-Free sovereign paper (Treasury Bills / Government Bonds) AND Equity assets (Major Stock Exchange Indices or Blue-chip Stocks index tracker) in the rates array.

        Return a pristine, parsed JSON format EXACTLY matching these keys:
        {
          "sourceName": "Name of local Central Bank & primary Stock Exchange (e.g. US Federal Reserve & Wall Street / Toronto Stock Exchange & BOC / Bank of Ghana & GSE)",
          "localInflation": "percentage string like '2.8%', '3.1%', '22.8%' or '31.5%'",
          "rates": [
            { "asset": "Treasury Bill Yield", "rate": "Percentage yield string", "trend": "up" | "down" | "flat", "safety": "Risk-Free Sovereign Credit", "source": "Central Bank" },
            { "asset": "Stock Market Index", "rate": "Latest year-to-date performance percentage string", "trend": "up" | "down" | "flat", "safety": "Market Equity Risk", "source": "Exchange" },
            { "asset": "Commercial Fixed Deposit", "rate": "Percentage yield string", "trend": "up" | "down" | "flat", "safety": "High", "source": "Banks" },
            { "asset": "Equity Mutual Fund", "rate": "Annualized percentage return string", "trend": "up" | "down" | "flat", "safety": "Medium-High Risk", "source": "Fund Desk" }
          ],
          "lastChecked": "Current Date string in 2026",
          "marketAdvisory": "A very concise 2-sentence expert advice on current local market inflation vectors, high-growth stock hedging portfolios, and smart balance allocations between government yield credits and public equity markets."
        }
      `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `${sysPrompt}\nPerform a live web search for the latest mid-2026 financial and stock indices for base currency code: "${currency}" and generate a formatted JSON object.`,
      config: { responseMimeType: "application/json", tools: [{ googleSearch: {} }], temperature: 0.15 },
    });

    const parsedResponse = JSON.parse(stripJsonFence(response.text || "{}"));
    res.json(parsedResponse);
  } catch (err) {
    console.error("Live investments error:", err);
    respondWithFallback();
  }
});
