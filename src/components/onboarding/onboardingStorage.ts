// Split out from OnboardingFlow.tsx so App.tsx can read this key without a
// static import of the onboarding component itself - App.tsx lazy-loads
// OnboardingFlow, and a static import of anything from that module (even
// just a constant) would pull the whole component tree back into the main
// bundle, defeating the code-split.
export const ONBOARDING_COMPLETE_KEY = "aziiki_onboarding_completed";
