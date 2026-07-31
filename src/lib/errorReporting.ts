// AZIIKI ERROR SYSTEM — client-side error reporting.
//
// Captures what's actually knowable from inside the browser (the server
// can't see screen size, user agent, or "what tab was the user on") and
// ships it, best-effort, to POST /api/errors/report (src/server/routes/errors.ts),
// which persists to the error_logs table (see supabase/migrations/0031_error_logs.sql)
// and forwards to the optional Slack/Discord/Telegram alert channel for
// critical events (see src/server/notifications/errorAlert.ts).
//
// This function must NEVER throw and must NEVER block the caller - reporting
// an error must not itself become a source of errors or a perceptible delay.
// If it fails (offline, server down, ad-blocker), it just gives up silently;
// the local console.error a caller already did is the fallback.

const SESSION_ID_KEY = "aziiki_error_session_id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    // sessionStorage can throw in locked-down/private-browsing contexts.
    return "unavailable";
  }
}

export interface ClientErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  source: "error-boundary" | "window-error" | "unhandled-rejection" | "api-error";
  status?: number;
  requestId?: string;
  endpoint?: string;
  currentTab?: string;
}

export function reportClientError(report: ClientErrorReport): void {
  try {
    const payload = {
      ...report,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      screen:
        typeof window !== "undefined"
          ? { width: window.screen?.width, height: window.screen?.height, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight }
          : undefined,
      language: typeof navigator !== "undefined" ? navigator.language : undefined,
      online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
      sessionId: getSessionId(),
      // import.meta.env.MODE is Vite's built-in "development" | "production" flag -
      // no extra env var needed to know which build reported this.
      environment: import.meta.env.MODE,
      timestamp: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);

    // navigator.sendBeacon fires even as the page is unloading (e.g. a crash
    // during navigation away) and doesn't block; fall back to a
    // fire-and-forget fetch where sendBeacon isn't available.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/errors/report", blob);
      if (sent) return;
    }

    fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* best-effort - reporting failure must never itself cause a problem */
    });
  } catch {
    /* never let error reporting throw */
  }
}

/**
 * Wires window-level catches for errors that happen outside any React
 * component's render (event handlers, timers, promise rejections) - a
 * React ErrorBoundary only ever sees render-time crashes, not these.
 * Call once, near app startup (see main.tsx).
 */
export function installGlobalErrorReporting(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportClientError({
      message: event.message || "Unknown window error",
      stack: event.error?.stack,
      source: "window-error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    reportClientError({
      message: reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection"),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: "unhandled-rejection",
    });
  });
}
