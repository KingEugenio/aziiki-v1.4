import { getServiceRoleClient } from "../supabaseClients";
import { env } from "../env";
import { dispatchErrorAlert } from "../notifications/errorAlert";

export type ErrorLogLevel = "info" | "warning" | "error" | "critical";
export type ErrorLogSource = "server" | "error-boundary" | "window-error" | "unhandled-rejection" | "api-error";

export interface ErrorLogEntry {
  level: ErrorLogLevel;
  source: ErrorLogSource;
  message: string;
  stack?: string;
  componentStack?: string;
  method?: string;
  endpoint?: string;
  statusCode?: number;
  requestId?: string;
  userId?: string | null;
  businessId?: string | null;
  userAgent?: string;
  url?: string;
  ip?: string;
  extra?: Record<string, unknown>;
}

/**
 * Durable error log (public.error_logs — see supabase/migrations/0031_error_logs.sql),
 * plus, for level:"critical" only, a best-effort push to whatever alert
 * channel(s) are configured (see notifications/errorAlert.ts). Written with
 * the service-role client for the same reason security_events is: a good
 * fraction of what needs logging here happens with no valid user session at
 * all (an auth failure, a network error before login, a crash on the sign-in
 * screen).
 *
 * Never throws, and never lets a Supabase failure take down the request it's
 * observing - logging an error must not itself become a second error. Always
 * also console.error()s so local dev and any platform-level log aggregation
 * (Vercel/Render/Fly logs, etc.) sees it even if the DB write fails.
 */
export async function logError(entry: ErrorLogEntry): Promise<void> {
  console.error(`[error_logs:${entry.level}] (${entry.source}) ${entry.message}`, entry.requestId ? `request_id=${entry.requestId}` : "");

  try {
    const supabase = getServiceRoleClient();
    const { error } = await supabase.from("error_logs").insert({
      level: entry.level,
      source: entry.source,
      message: entry.message,
      stack: entry.stack ?? null,
      component_stack: entry.componentStack ?? null,
      method: entry.method ?? null,
      endpoint: entry.endpoint ?? null,
      status_code: entry.statusCode ?? null,
      request_id: entry.requestId ?? null,
      user_id: entry.userId ?? null,
      business_id: entry.businessId ?? null,
      environment: env.NODE_ENV,
      release_version: env.RELEASE_VERSION,
      user_agent: entry.userAgent ?? null,
      url: entry.url ?? null,
      ip: entry.ip ?? null,
      extra: entry.extra ?? null,
    });
    if (error) {
      console.error("[error_logs] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[error_logs] unexpected failure writing log:", err);
  }

  if (entry.level === "critical") {
    dispatchErrorAlert({
      message: entry.message,
      source: entry.source,
      statusCode: entry.statusCode,
      endpoint: entry.endpoint,
      requestId: entry.requestId,
      environment: env.NODE_ENV,
      releaseVersion: env.RELEASE_VERSION,
      occurredAt: new Date().toISOString(),
    }).catch((err) => console.error("[error_logs] alert dispatch failed:", err));
  }
}
