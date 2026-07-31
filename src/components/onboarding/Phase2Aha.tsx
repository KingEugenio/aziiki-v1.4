import React from "react";
import { motion } from "motion/react";
import { getAhaContent, OnboardingAnswers } from "./utils/personalization";

interface Phase2AhaProps {
  answers: OnboardingAnswers;
  onContinue: () => void;
}

const TONE_CLASSES: Record<string, string> = {
  positive: "text-[color:var(--color-onboard-green)]",
  negative: "text-rose-600",
  warning: "text-[color:var(--color-onboard-amber)]",
  neutral: "text-slate-800",
};

/**
 * Phase 2 - THE Aha moment. Deliberately not skippable (no ProgressBar skip
 * link is rendered for this step - see OnboardingFlow) because this single
 * screen is the biggest predictor of whether the user sticks around.
 */
export default function Phase2Aha({ answers, onContinue }: Phase2AhaProps) {
  const content = getAhaContent(answers);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="w-full max-w-md mx-auto text-center"
    >
      <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest text-[color:var(--color-onboard-teal)] bg-[color:var(--color-onboard-teal)]/10 px-2.5 py-1 rounded-full mb-3">
        {content.eyebrow}
      </span>
      <h1 className="text-2xl sm:text-[26px] font-heading font-extrabold text-slate-900 mb-2 leading-tight">
        {content.headline}
      </h1>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">{content.subheadline}</p>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-900/5 overflow-hidden text-left">
        <div className="bg-[color:var(--color-onboard-cream)] px-5 py-3 flex items-center justify-between border-b border-slate-200">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Sample data preview
          </span>
          <span className="w-2 h-2 rounded-full bg-[color:var(--color-onboard-green)] animate-pulse" />
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-100 px-5 py-4">
          {content.stats.map((stat) => (
            <div key={stat.label} className="text-center px-1">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mb-1 leading-tight">
                {stat.label}
              </p>
              <p className={`text-sm sm:text-base font-mono font-extrabold ${TONE_CLASSES[stat.tone]}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="px-5 pb-4 pt-1 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-3">
            {content.detailTitle}
          </p>
          <div className="space-y-1.5">
            {content.detailRows.map((row) => (
              <div key={row.left} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{row.left}</span>
                <span className={`font-mono font-bold ${row.emphasis ? "text-[color:var(--color-onboard-amber)]" : "text-slate-700"}`}>
                  {row.right}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500 italic mt-4 mb-6 leading-relaxed">💡 {content.tip}</p>

      <button
        type="button"
        onClick={onContinue}
        className="w-full bg-[color:var(--color-onboard-teal)] hover:opacity-90 text-white font-heading font-bold py-3.5 rounded-2xl shadow-lg shadow-[color:var(--color-onboard-teal)]/20 transition-opacity cursor-pointer"
      >
        This is exactly what I need →
      </button>
    </motion.div>
  );
}
