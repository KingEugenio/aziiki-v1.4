import React from "react";
import { motion, AnimatePresence } from "motion/react";
import QuestionCard from "./QuestionCard";
import {
  BUSINESS_TYPE_OPTIONS,
  REVENUE_OPTIONS,
  CHALLENGE_OPTIONS,
  OnboardingAnswers,
  BusinessType,
  RevenueBracket,
  Challenge,
} from "./utils/personalization";

export type AskStep = 0 | 1 | 2;

interface Phase1AskProps {
  step: AskStep;
  answers: OnboardingAnswers;
  onAnswer: (value: BusinessType | RevenueBracket | Challenge) => void;
}

const businessTypeLabel = (t?: BusinessType) => BUSINESS_TYPE_OPTIONS.find((o) => o.value === t)?.label;

/** Renders whichever of the 3 Ask questions `step` points at. One tap on a
 * QuestionCard both answers the question and advances the flow - there is
 * no separate "Next" button, matching the single-tap requirement. */
export default function Phase1Ask({ step, answers, onAnswer }: Phase1AskProps) {
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="ask-business-type"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-onboard-teal)] mb-2 font-mono">
              Let's get to know your business
            </p>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">
              What kind of business do you run?
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              This changes what we show you next.
            </p>
            <div className="space-y-2.5">
              {BUSINESS_TYPE_OPTIONS.map((opt, i) => (
                <QuestionCard
                  key={opt.value}
                  label={opt.label}
                  emoji={opt.emoji}
                  index={i}
                  selected={answers.businessType === opt.value}
                  onSelect={() => onAnswer(opt.value)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="ask-revenue"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-onboard-teal)] mb-2 font-mono">
              {businessTypeLabel(answers.businessType) ?? "Your business"}
            </p>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">
              Roughly, what's your monthly revenue?
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              We'll scale your examples to match - no judgment, just context.
            </p>
            <div className="space-y-2.5">
              {REVENUE_OPTIONS.map((opt, i) => (
                <QuestionCard
                  key={opt.value}
                  label={opt.label}
                  index={i}
                  selected={answers.revenue === opt.value}
                  onSelect={() => onAnswer(opt.value)}
                />
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="ask-challenge"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-onboard-teal)] mb-2 font-mono">
              Almost there
            </p>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">
              What's your biggest financial headache right now?
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              We'll show you exactly how Aziiki helps with this.
            </p>
            <div className="space-y-2.5">
              {CHALLENGE_OPTIONS.map((opt, i) => (
                <QuestionCard
                  key={opt.value}
                  label={opt.label}
                  emoji={opt.emoji}
                  index={i}
                  selected={answers.challenge === opt.value}
                  onSelect={() => onAnswer(opt.value)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
