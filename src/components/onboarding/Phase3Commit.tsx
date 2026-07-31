import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api, ApiError } from "../../lib/api";
import { getPaywallContent, OnboardingAnswers } from "./utils/personalization";

export type CommitStep = 0 | 1;

interface Phase3CommitProps {
  step: CommitStep;
  answers: OnboardingAnswers;
  onSignedUp: () => void;
  onChoosePlan: (plan: "trial" | "free") => void;
}

/**
 * Phase 3 - Commit. Screen 1 frames sign-up as "saving progress" (the
 * progress being the personalized preview they just saw in Phase 2), screen
 * 2 is a soft paywall whose benefits are pulled straight from their Phase 1
 * answers so it reads as a plan, not a toll booth.
 */
export default function Phase3Commit({ step, answers, onSignedUp, onChoosePlan }: Phase3CommitProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email || password.length < 8) {
      setErrorMsg("Enter your email and an 8+ character password.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.auth.signup({ email, password });
      setSuccessMsg(result.message);
      setTimeout(onSignedUp, 900);
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const paywall = getPaywallContent(answers);

  return (
    <div className="w-full max-w-md mx-auto text-center">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="commit-signup"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-onboard-teal)] mb-2 font-mono">
              Save your progress
            </p>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 mb-2">
              Don't lose what you just saw
            </h1>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Create a free account so your business setup, and everything you add from here, is saved to the cloud.
            </p>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl p-3 mb-4 text-left">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-[color:var(--color-onboard-green)]/10 border border-[color:var(--color-onboard-green)]/30 text-[color:var(--color-onboard-green)] text-xs font-semibold rounded-xl p-3 mb-4 text-left">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-3 text-left">
              <input
                type="email"
                required
                placeholder="you@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[color:var(--color-onboard-teal)] transition-colors font-sans"
              />
              <input
                type="password"
                required
                placeholder="Create a password (8+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[color:var(--color-onboard-teal)] transition-colors font-mono"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[color:var(--color-onboard-teal)] hover:opacity-90 text-white font-heading font-bold py-3.5 rounded-2xl shadow-lg shadow-[color:var(--color-onboard-teal)]/20 transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isLoading ? "Saving..." : "Save my progress"}
              </button>
            </form>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="commit-paywall"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-onboard-amber)] mb-2 font-mono">
              {paywall.goalCallout}
            </p>
            <h1 className="text-2xl font-heading font-extrabold text-slate-900 mb-5 leading-tight">
              {paywall.headline}
            </h1>

            <div className="bg-white border-2 border-[color:var(--color-onboard-teal)] rounded-3xl shadow-xl shadow-[color:var(--color-onboard-teal)]/10 p-5 text-left mb-4">
              <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-widest text-white bg-[color:var(--color-onboard-teal)] px-2.5 py-1 rounded-full mb-3">
                Aziiki Premium
              </span>
              <ul className="space-y-2.5">
                {paywall.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-[color:var(--color-onboard-green)] font-bold mt-0.5 shrink-0">✓</span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onChoosePlan("trial")}
              className="w-full bg-[color:var(--color-onboard-teal)] hover:opacity-90 text-white font-heading font-bold py-3.5 rounded-2xl shadow-lg shadow-[color:var(--color-onboard-teal)]/20 transition-opacity cursor-pointer mb-2.5"
            >
              {paywall.ctaLabel} - 14 days free
            </button>
            <button
              type="button"
              onClick={() => onChoosePlan("free")}
              className="w-full text-slate-500 hover:text-slate-700 font-semibold text-xs py-2 transition-colors cursor-pointer"
            >
              Continue with the free plan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
