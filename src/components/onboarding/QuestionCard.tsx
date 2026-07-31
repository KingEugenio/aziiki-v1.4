import React from "react";
import { motion } from "motion/react";

interface QuestionCardProps {
  label: string;
  emoji?: string;
  selected?: boolean;
  onSelect: () => void;
  index?: number;
}

/** A single-tap answer card. Selecting it is the entire interaction - no
 * separate "confirm" step, no form fields. */
export default function QuestionCard({ label, emoji, selected, onSelect, index = 0 }: QuestionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
      whileTap={{ scale: 0.97 }}
      className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-2xl border-2 transition-colors cursor-pointer font-sans ${
        selected
          ? "border-[color:var(--color-onboard-teal)] bg-[color:var(--color-onboard-teal)]/10"
          : "border-slate-200 bg-white hover:border-[color:var(--color-onboard-teal)]/40 hover:bg-[color:var(--color-onboard-cream)]"
      }`}
    >
      {emoji && <span className="text-xl leading-none shrink-0">{emoji}</span>}
      <span
        className={`text-sm font-semibold ${
          selected ? "text-[color:var(--color-onboard-teal)]" : "text-slate-700"
        }`}
      >
        {label}
      </span>
      {selected && (
        <span className="ml-auto w-5 h-5 rounded-full bg-[color:var(--color-onboard-teal)] text-white flex items-center justify-center text-[11px] shrink-0">
          ✓
        </span>
      )}
    </motion.button>
  );
}
