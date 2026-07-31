import React, { useEffect, useRef, useState } from "react";
import ProgressBar from "./ProgressBar";
import Phase1Ask, { AskStep } from "./Phase1Ask";
import Phase2Aha from "./Phase2Aha";
import Phase3Commit, { CommitStep } from "./Phase3Commit";
import { OnboardingAnswers, BusinessType, RevenueBracket, Challenge } from "./utils/personalization";
import Logo from "../Logo";
import { ONBOARDING_COMPLETE_KEY } from "./onboardingStorage";

const STORAGE_KEY = "aziiki_onboarding_state";
export { ONBOARDING_COMPLETE_KEY };

const TOTAL_STEPS = 6;
const SCREEN_NAMES = [
  "ask_business_type",
  "ask_revenue",
  "ask_challenge",
  "aha_moment",
  "commit_signup",
  "commit_paywall",
] as const;

interface StoredState {
  step: number;
  answers: OnboardingAnswers;
}

interface OnboardingFlowProps {
  /** Called once the flow is done - either the user reached the end, or
   * skipped out of it entirely. `signedUp` reflects whether Phase 3's
   * signup form actually succeeded. */
  onFinish: (result: { signedUp: boolean }) => void;
}

/** console.log-based analytics for now - swap the body of this one function
 * for a real provider (PostHog, etc.) later without touching any screen. */
function track(event: string, payload: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(`[analytics] ${event}`, payload);
}

function loadStoredState(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.step === "number" && parsed.answers) return parsed;
    return null;
  } catch {
    return null;
  }
}

export default function OnboardingFlow({ onFinish }: OnboardingFlowProps) {
  const initial = loadStoredState();
  const [step, setStep] = useState<number>(initial?.step ?? 0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initial?.answers ?? {});
  const [hasSignedUp, setHasSignedUp] = useState(false);

  const flowStartedAt = useRef<number>(Date.now());
  const screenEnteredAt = useRef<number>(Date.now());

  // Persist on every change so a closed tab resumes exactly where it left off.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers }));
  }, [step, answers]);

  // Fire a screen-viewed event whenever the visible screen changes, and
  // reset the per-screen timer used for "time on screen" analytics.
  useEffect(() => {
    track("onboarding_screen_viewed", { screen: SCREEN_NAMES[step], screenNumber: step + 1 });
    screenEnteredAt.current = Date.now();
  }, [step]);

  const timeOnScreen = () => Date.now() - screenEnteredAt.current;

  const goTo = (nextStep: number) => setStep(Math.max(0, Math.min(TOTAL_STEPS - 1, nextStep)));

  const finishFlow = (signedUp: boolean) => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    track("onboarding_completed", {
      totalTimeMs: Date.now() - flowStartedAt.current,
      businessType: answers.businessType ?? null,
      signedUp,
    });
    onFinish({ signedUp });
  };

  const handleAsk1Answer = (value: BusinessType | RevenueBracket | Challenge) => {
    const key = step === 0 ? "businessType" : step === 1 ? "revenue" : "challenge";
    track("onboarding_answer_selected", { screen: SCREEN_NAMES[step], answer: value, timeOnScreenMs: timeOnScreen() });
    setAnswers((prev) => ({ ...prev, [key]: value }));
    // Small delay so the tap's selected/checkmark state is visible before
    // the screen transitions away - feels snappy, not instantaneous-jarring.
    setTimeout(() => goTo(step + 1), 220);
  };

  const handleSkip = () => {
    track("onboarding_screen_skipped", { screen: SCREEN_NAMES[step] });
    if (step >= TOTAL_STEPS - 1) {
      // Skipping the very last screen (the paywall) has nowhere to advance
      // to - it just means "finish without picking a plan".
      finishFlow(hasSignedUp);
    } else {
      goTo(step + 1);
    }
  };

  const handleBack = () => goTo(step - 1);

  const handleAhaContinue = () => goTo(step + 1);

  const handleSignedUp = () => {
    setHasSignedUp(true);
    goTo(step + 1);
  };

  const handleChoosePlan = (plan: "trial" | "free") => {
    track("onboarding_answer_selected", { screen: SCREEN_NAMES[step], answer: plan, timeOnScreenMs: timeOnScreen() });
    finishFlow(hasSignedUp);
  };

  const isAskStep = step <= 2;
  const isAhaStep = step === 3;
  const isCommitStep = step === 4 || step === 5;

  return (
    <div className="min-h-screen bg-[color:var(--color-onboard-cream)] flex flex-col items-center justify-between p-5 sm:p-8 font-sans">
      <div className="w-full max-w-md mx-auto flex items-center justify-center gap-2 mb-6 mt-2">
        <Logo size={28} className="shadow-sm rounded-lg" />
        <span className="font-heading font-extrabold text-slate-900 text-sm tracking-tight">Aziiki</span>
      </div>

      <div className="w-full mb-8">
        <ProgressBar
          currentStep={step + 1}
          totalSteps={TOTAL_STEPS}
          onBack={step > 0 ? handleBack : undefined}
          onSkip={handleSkip}
          skippable={!isAhaStep}
        />
      </div>

      <div className="flex-1 w-full flex items-center justify-center">
        {isAskStep && <Phase1Ask step={step as AskStep} answers={answers} onAnswer={handleAsk1Answer} />}
        {isAhaStep && <Phase2Aha answers={answers} onContinue={handleAhaContinue} />}
        {isCommitStep && (
          <Phase3Commit
            step={(step - 4) as CommitStep}
            answers={answers}
            onSignedUp={handleSignedUp}
            onChoosePlan={handleChoosePlan}
          />
        )}
      </div>

      <p className="text-[10px] text-slate-400 mt-8 mb-1 font-mono">Your answers are saved automatically.</p>
    </div>
  );
}
