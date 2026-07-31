import { LockKey, ShieldWarning, Wrench, WifiSlash, CloudWarning, ClockCountdown } from "@phosphor-icons/react";
import type { StatusScreenProps } from "./StatusScreen";

// AZIIKI ERROR SYSTEM — shared copy + icon + tone for the handful of
// full-screen situations this app actually has. Centralized here so the
// wording is consistent wherever a screen is shown, and so product copy can
// be reviewed/edited in one place instead of hunting through components.
// Every message follows the same rule: explain plainly, never blame the
// user, never show a raw status code or stack trace.

export function sessionExpiredStatus(onLogin: () => void): Omit<StatusScreenProps, "fullScreen"> {
  return {
    icon: LockKey,
    tone: "neutral",
    eyebrow: "Session expired",
    title: "You've been signed out",
    message: "For your security, sessions expire after a period of inactivity. Sign back in to pick up right where you left off - nothing you've saved has been lost.",
    actions: [{ label: "Sign in again", onClick: onLogin, variant: "primary" }],
  };
}

export function forbiddenStatus(onRequestAccess: () => void, onGoHome: () => void): Omit<StatusScreenProps, "fullScreen"> {
  return {
    icon: ShieldWarning,
    tone: "warning",
    eyebrow: "Restricted",
    title: "You don't have access to this",
    message: "This area is limited to specific team roles. If you think you should be able to see this, ask an owner or admin on this business to grant you access.",
    actions: [
      { label: "Request access", onClick: onRequestAccess, variant: "primary" },
      { label: "Back to dashboard", onClick: onGoHome, variant: "secondary" },
    ],
  };
}

export function maintenanceStatus(estimatedReturn: string | undefined, onRefresh: () => void): Omit<StatusScreenProps, "fullScreen"> {
  return {
    icon: Wrench,
    tone: "neutral",
    eyebrow: "Scheduled maintenance",
    title: "We're making a few improvements",
    message: estimatedReturn
      ? `Aziiki is briefly offline for planned maintenance. We expect to be back by ${estimatedReturn}. Your data is safe and nothing is lost.`
      : "Aziiki is briefly offline for planned maintenance. We expect to be back shortly. Your data is safe and nothing is lost.",
    actions: [{ label: "Check again", onClick: onRefresh, variant: "primary" }],
  };
}

export function offlineStatus(onRetry: () => void): Omit<StatusScreenProps, "fullScreen"> {
  return {
    icon: WifiSlash,
    tone: "warning",
    eyebrow: "No connection",
    title: "You're offline",
    message: "This part of Aziiki needs an internet connection. Changes you've already made are saved on this device and will sync automatically once you're back online.",
    actions: [{ label: "Try again", onClick: onRetry, variant: "primary" }],
  };
}

export function serverErrorStatus(onRetry: () => void, onGoHome: () => void): Omit<StatusScreenProps, "fullScreen"> {
  return {
    icon: CloudWarning,
    tone: "danger",
    eyebrow: "Our side, not yours",
    title: "We've run into an unexpected problem",
    message: "We're already looking into it. Your data is safe. Try again in a moment, or head back to your dashboard.",
    actions: [
      { label: "Retry", onClick: onRetry, variant: "primary" },
      { label: "Go to Dashboard", onClick: onGoHome, variant: "secondary" },
    ],
  };
}

export function rateLimitedStatus(secondsRemaining: number, onRetry: () => void): Omit<StatusScreenProps, "fullScreen"> {
  return {
    icon: ClockCountdown,
    tone: "warning",
    eyebrow: "Slow down a moment",
    title: "You're doing that a little too fast",
    message: `To keep things running smoothly for everyone, please wait a moment before trying again.${
      secondsRemaining > 0 ? ` You can try again in ${secondsRemaining}s.` : ""
    }`,
    actions: secondsRemaining <= 0 ? [{ label: "Try again", onClick: onRetry, variant: "primary" }] : [],
  };
}
