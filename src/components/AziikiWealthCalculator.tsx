import React, { useMemo, useState } from "react";
import { Calculator, TrendUp as TrendingUp, Info } from "@phosphor-icons/react";

// ─────────────────────────────────────────────────────────────────────────
// AZIIKI BASIC VERSION 1.0 — AZIIKI Wealth Calculator (compound interest).
// A self-contained, client-side-only educational tool. Deliberately does
// NOT touch the (currently hidden) full Wealth & Goals / NetWorthInvestments
// module — no shared state, no backend calls, nothing to break. Formula:
//   A = P(1 + r/n)^(nt) + contributions compounded the same way.
// ─────────────────────────────────────────────────────────────────────────

interface AziikiWealthCalculatorProps {
  currencySymbol: string;
}

type CompoundFrequency = "daily" | "monthly" | "quarterly" | "yearly";

const FREQUENCY_N: Record<CompoundFrequency, number> = {
  daily: 365,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

function computeProjection(
  principal: number,
  monthlyContribution: number,
  annualRatePct: number,
  years: number,
  frequency: CompoundFrequency
) {
  const n = FREQUENCY_N[frequency];
  const r = annualRatePct / 100;
  const totalPeriods = n * years;
  const ratePerPeriod = r / n;

  // Contributions are made monthly regardless of compounding frequency;
  // convert to an equivalent per-compounding-period contribution.
  const contributionPerPeriod = (monthlyContribution * 12) / n;

  const points: { year: number; balance: number; contributed: number }[] = [];
  let balance = principal;
  let contributed = principal;

  for (let period = 1; period <= totalPeriods; period++) {
    balance = balance * (1 + ratePerPeriod) + contributionPerPeriod;
    contributed += contributionPerPeriod;
    if (period % n === 0) {
      points.push({ year: period / n, balance, contributed });
    }
  }

  const finalValue = balance;
  const totalContributed = contributed;
  const interestEarned = finalValue - totalContributed;

  return { finalValue, totalContributed, interestEarned, points };
}

export default function AziikiWealthCalculator({ currencySymbol }: AziikiWealthCalculatorProps) {
  const [principal, setPrincipal] = useState(1000);
  const [monthlyContribution, setMonthlyContribution] = useState(100);
  const [annualRate, setAnnualRate] = useState(10);
  const [years, setYears] = useState(10);
  const [frequency, setFrequency] = useState<CompoundFrequency>("monthly");

  const result = useMemo(
    () => computeProjection(principal || 0, monthlyContribution || 0, annualRate || 0, years || 1, frequency),
    [principal, monthlyContribution, annualRate, years, frequency]
  );

  const fmt = (n: number) =>
    `${currencySymbol}${Math.round(n).toLocaleString()}`;

  const maxBalance = Math.max(...result.points.map((p) => p.balance), 1);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5" id="aziiki-wealth-calculator">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 font-sans">AZIIKI Wealth Calculator</h3>
            <p className="text-[10px] text-slate-450 font-mono">Compound interest & savings growth projector</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Starting Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{currencySymbol}</span>
            <input
              type="number"
              min={0}
              value={principal}
              onChange={(e) => setPrincipal(Math.max(0, Number(e.target.value)))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-2 py-2 text-xs outline-none focus:border-emerald-500 focus:bg-white font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Monthly Top-Up</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">{currencySymbol}</span>
            <input
              type="number"
              min={0}
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value)))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-2 py-2 text-xs outline-none focus:border-emerald-500 focus:bg-white font-mono"
            />
          </div>
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Annual Return</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={annualRate}
              onChange={(e) => setAnnualRate(Math.max(0, Number(e.target.value)))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-7 py-2 text-xs outline-none focus:border-emerald-500 focus:bg-white font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">%</span>
          </div>
        </div>
        <div>
          <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1">Duration</label>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={50}
              value={years}
              onChange={(e) => setYears(Math.max(1, Number(e.target.value)))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-14 py-2 text-xs outline-none focus:border-emerald-500 focus:bg-white font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">years</span>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[9px] font-mono font-bold text-slate-450 uppercase block mb-1.5">Compounding Frequency</label>
        <div className="grid grid-cols-4 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
          {(["daily", "monthly", "quarterly", "yearly"] as CompoundFrequency[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFrequency(f)}
              className={`py-1.5 text-[10px] font-bold font-sans rounded-lg transition-colors capitalize cursor-pointer ${
                frequency === f ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <span className="text-[9px] font-mono font-bold text-slate-450 uppercase block">Total Invested</span>
          <span className="text-sm font-black text-slate-800 font-sans">{fmt(result.totalContributed)}</span>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <span className="text-[9px] font-mono font-bold text-emerald-700 uppercase block">Interest Earned</span>
          <span className="text-sm font-black text-emerald-700 font-sans">{fmt(result.interestEarned)}</span>
        </div>
        <div className="bg-slate-900 rounded-xl p-3">
          <span className="text-[9px] font-mono font-bold text-slate-300 uppercase block">Future Value</span>
          <span className="text-sm font-black text-white font-sans">{fmt(result.finalValue)}</span>
        </div>
      </div>

      {/* Simple bar-based growth chart — no external chart library needed */}
      <div>
        <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-slate-450 uppercase mb-2">
          <TrendingUp className="w-3 h-3" /> Growth Over Time
        </div>
        <div className="flex items-end gap-1 h-24">
          {result.points.map((p) => (
            <div key={p.year} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
              <div
                className="w-full bg-emerald-500/80 rounded-t-sm group-hover:bg-emerald-600 transition-colors"
                style={{ height: `${Math.max(4, (p.balance / maxBalance) * 100)}%` }}
                title={`Year ${p.year}: ${fmt(p.balance)}`}
              />
              {(p.year === 1 || p.year % Math.ceil(years / 6 || 1) === 0 || p.year === years) && (
                <span className="text-[7px] text-slate-400 font-mono">{p.year}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-800 leading-relaxed">
          This is an educational projection based on the numbers you enter, not a guarantee or financial advice.
          Real returns vary and are never perfectly steady. Talk to a licensed financial advisor before making
          investment decisions.
        </p>
      </div>
    </div>
  );
}
