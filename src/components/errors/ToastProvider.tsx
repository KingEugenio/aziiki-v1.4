import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, WarningCircle, Warning, Info, X } from "@phosphor-icons/react";

// AZIIKI ERROR SYSTEM — the generic toast/alert surface. This app is a
// tab-based SPA with no URL router (see App.tsx's activeTab state), so most
// "error page" scenarios from a traditional multi-page app map here instead
// of to a full-screen takeover: a failed save, a 409 conflict, a 422
// validation summary, a 429 rate limit, a payment failure, the AI advisor
// being unavailable, a failed upload/export/import. StatusScreen.tsx is for
// the handful of situations where the *whole* screen needs to explain
// itself (signed out, forbidden, crashed, maintenance, offline) - see that
// file's header comment for the reasoning split.

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  variant?: ToastVariant;
  title: string;
  message?: string;
  /** ms before auto-dismiss. 0 = stays until manually closed (use for things needing a decision, e.g. a conflict). */
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends Required<Pick<ToastInput, "variant" | "title">> {
  id: string;
  message?: string;
  duration: number;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_CONFIG: Record<ToastVariant, { icon: typeof CheckCircle; chipClass: string }> = {
  success: { icon: CheckCircle, chipClass: "az-chip-positive" },
  error: { icon: WarningCircle, chipClass: "az-chip-negative" },
  warning: { icon: Warning, chipClass: "az-chip-warning" },
  info: { icon: Info, chipClass: "az-chip-accent" },
};

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = "toast-" + Math.random().toString(36).slice(2, 10);
      const duration = toast.duration ?? DEFAULT_DURATION;
      const item: ToastItem = {
        id,
        variant: toast.variant ?? "info",
        title: toast.title,
        message: toast.message,
        duration,
        action: toast.action,
      };
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), item]);
      if (duration > 0) {
        const timer = setTimeout(() => dismissToast(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        className="fixed z-[9999] inset-x-0 bottom-0 sm:bottom-auto sm:top-4 sm:right-4 sm:inset-x-auto flex flex-col-reverse sm:flex-col gap-2 p-3 sm:p-0 pointer-events-none w-full sm:w-[360px]"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const config = VARIANT_CONFIG[t.variant];
            const IconComponent = config.icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.15 } }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="az-card az-elevation-3 p-3.5 flex items-start gap-2.5 pointer-events-auto font-sans"
                role="status"
              >
                <span className={`p-1.5 rounded-lg shrink-0 ${config.chipClass}`}>
                  <IconComponent className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                    {t.title}
                  </p>
                  {t.message && (
                    <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {t.message}
                    </p>
                  )}
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action?.onClick();
                        dismissToast(t.id);
                      }}
                      className="text-[11px] font-bold mt-1.5 hover:underline cursor-pointer"
                      style={{ color: "var(--accent)" }}
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(t.id)}
                  aria-label="Dismiss"
                  className="shrink-0 p-0.5 rounded cursor-pointer"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fails loudly in development so a missing <ToastProvider> is caught
    // immediately rather than silently no-op-ing toasts in production.
    throw new Error("useToast() must be used within <ToastProvider>. Wrap the app root in main.tsx.");
  }
  return ctx;
}
