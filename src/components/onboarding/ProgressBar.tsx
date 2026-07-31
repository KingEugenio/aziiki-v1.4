import React from "react";

interface ProgressBarProps {
  currentStep: number; // 1-indexed
  totalSteps: number;
  onBack?: () => void;
  onSkip?: () => void;
  skippable?: boolean;
}

export default function ProgressBar({ currentStep, totalSteps, onBack, onSkip, skippable = true }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));

  return (
    <div className="w-full max-w-md mx-auto px-1">
      <div className="flex items-center justify-between mb-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] font-bold text-slate-400 hover:text-[color:var(--color-onboard-teal)] transition-colors cursor-pointer px-1 py-1"
            aria-label="Go back"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}

        <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
          {currentStep} / {totalSteps}
        </span>

        {skippable && onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer px-1 py-1"
          >
            Skip
          </button>
        ) : (
          <span />
        )}
      </div>

      <div className="h-1.5 w-full bg-[color:var(--color-onboard-cream)] rounded-full overflow-hidden border border-black/5">
        <div
          className="h-full rounded-full bg-[color:var(--color-onboard-teal)] transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
