import React from "react";
import type { Icon } from "@phosphor-icons/react";

// AZIIKI ERROR SYSTEM — one reusable, config-driven full-panel status screen
// instead of a pile of bespoke "404 page" / "500 page" components. Aziiki is
// a tab-based single-page app with no URL router (see App.tsx's activeTab
// state), so the classic per-route error page doesn't map cleanly here.
// What DOES map: a small set of real situations where the whole app-area
// needs to say "here's what's going on" instead of showing broken/blank UI -
// session expired, forbidden, a render crash, planned maintenance, and
// offline. Everything else (a failed save, a conflict, a validation error)
// is a transient, in-context problem and belongs in a toast, not a full
// screen takeover - see Toast.tsx.

export interface StatusAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
}

export interface StatusScreenProps {
  icon: Icon;
  eyebrow?: string;
  title: string;
  message: string;
  actions?: StatusAction[];
  tone?: "neutral" | "warning" | "danger";
  /** Optional extra content under the message (e.g. a countdown, a stack trace toggle). */
  children?: React.ReactNode;
  /** Renders full-viewport (app-crash, maintenance) vs. inline within the current layout (inline auth prompts). */
  fullScreen?: boolean;
}

const TONE_CHIP: Record<NonNullable<StatusScreenProps["tone"]>, string> = {
  neutral: "az-chip-accent",
  warning: "az-chip-warning",
  danger: "az-chip-negative",
};

export default function StatusScreen({
  icon: IconComponent,
  eyebrow,
  title,
  message,
  actions = [],
  tone = "neutral",
  children,
  fullScreen = false,
}: StatusScreenProps) {
  return (
    <div
      className={`flex items-center justify-center p-6 sm:p-10 font-sans ${fullScreen ? "min-h-screen" : "min-h-[420px]"}`}
      style={{ background: fullScreen ? "var(--surface-page)" : "transparent" }}
      role="status"
    >
      <div className="w-full max-w-md text-center space-y-5 animate-scale-in">
        <div
          className={`w-16 h-16 mx-auto rounded-3xl flex items-center justify-center ${TONE_CHIP[tone]}`}
          aria-hidden="true"
        >
          <IconComponent className="w-8 h-8" weight="duotone" />
        </div>

        <div className="space-y-1.5">
          {eyebrow && (
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
              {eyebrow}
            </p>
          )}
          <h1 className="text-lg sm:text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {message}
          </p>
        </div>

        {children}

        {actions.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            {actions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                className={`az-btn micro-press justify-center ${action.variant === "secondary" ? "az-btn-secondary" : "az-btn-primary"}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
