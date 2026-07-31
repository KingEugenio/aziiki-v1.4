import React from "react";
import type { Icon } from "@phosphor-icons/react";

// AZIIKI ERROR SYSTEM — shared empty-state block. Before this, "no
// customers yet" / "no invoices yet" / "no inventory yet" etc. were each a
// hand-rolled, differently-styled <div> scattered across six components
// (some using the az-* tokens, some hardcoded to light-mode-only Tailwind
// slate classes). One component now, consistent everywhere, dark-mode
// correct, with room for an icon and a real call-to-action button instead
// of just telling the user which button to go click somewhere else.

export interface EmptyStateProps {
  icon: Icon;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
  /** Tighter padding for use inside an already-bordered/cards container (most call sites). */
  compact?: boolean;
  className?: string;
}

export default function EmptyState({ icon: IconComponent, title, message, action, compact = false, className = "" }: EmptyStateProps) {
  return (
    <div className={`text-center ${compact ? "py-8 px-4" : "py-14 px-6"} ${className}`} role="status">
      <div
        className="w-11 h-11 mx-auto rounded-2xl flex items-center justify-center mb-3"
        style={{ background: "var(--surface-card-2)", color: "var(--text-tertiary)" }}
        aria-hidden="true"
      >
        <IconComponent className="w-5 h-5" />
      </div>
      <p className="text-xs font-bold font-sans" style={{ color: "var(--text-primary)" }}>
        {title}
      </p>
      <p className="text-[11px] font-sans mt-1 max-w-xs mx-auto leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
        {message}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="az-btn az-btn-secondary micro-press mt-3.5 mx-auto text-[11px] py-1.5 px-3"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
