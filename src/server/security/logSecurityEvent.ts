import { getServiceRoleClient } from "../supabaseClients";

export type SecurityAction =
  | "AUTH_SIGNUP"
  | "AUTH_LOGIN"
  | "AUTH_FAILURE"
  | "AUTH_LOCKOUT"
  | "AUTH_LOGOUT"
  | "MAGIC_LINK_REQUESTED"
  | "OTP_REQUESTED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "MFA_ENROLLED"
  | "MFA_CHALLENGE_FAILED";

/**
 * Durable audit trail (public.security_events), replacing the old in-memory
 * auditLogs[] array. Written with the service-role client because login
 * failures happen before any user session exists - there is no user-scoped
 * client to write with at that point. Never throws: a logging failure must
 * never block or fail the auth flow it's observing.
 */
export async function logSecurityEvent(event: {
  action: SecurityAction;
  email?: string | null;
  userId?: string | null;
  details?: string;
  ip?: string | null;
}): Promise<void> {
  try {
    const supabase = getServiceRoleClient();
    const { error } = await supabase.from("security_events").insert({
      action: event.action,
      email: event.email ?? null,
      user_id: event.userId ?? null,
      details: event.details ?? null,
      ip: event.ip ?? null,
    });
    if (error) {
      console.error("[security_events] insert failed:", error.message);
    }
  } catch (err) {
    console.error("[security_events] unexpected failure:", err);
  }
}
