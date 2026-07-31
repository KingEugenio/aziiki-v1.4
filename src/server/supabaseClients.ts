import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Anon-key client with no user session attached. Used only for the
 * pre-authentication auth flows (signup, login, magic link, OTP, password
 * reset) where Supabase Auth itself is the thing issuing/verifying
 * credentials - there is no user JWT yet to scope a client to.
 */
export function getAnonClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Per-request client scoped to the calling user's own Supabase access token.
 * Every data query made through this client runs through PostgREST AS that
 * user, so Postgres Row Level Security (user_id = auth.uid()) is what
 * ultimately decides what rows are visible/writable - not application code.
 * This is intentionally the ONLY client used for reading/writing business
 * data (transactions, invoices, etc).
 */
export function getUserScopedClient(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

/**
 * Service-role client. This BYPASSES Row Level Security entirely, so its use
 * is deliberately restricted to four narrow, audited purposes in this
 * codebase:
 *   1. writing to security_events (src/server/security/logSecurityEvent.ts),
 *      because failed-login events happen pre-authentication.
 *   2. the Paystack webhook (src/server/routes/paymentsWebhook.ts), because
 *      Paystack calls that endpoint directly with no session at all - the
 *      HMAC signature check is what authorizes it instead.
 *   3. inviting a team member by email (src/server/routes/
 *      businessMemberships.ts), because supabase.auth.admin.* is a
 *      privileged Auth API that only the service role can call at all - the
 *      route itself checks the caller's own role (Owner/Admin) before ever
 *      reaching this client, since RLS has no way to gate an Auth API call.
 *   4. writing to error_logs (src/server/logging/logError.ts), because a
 *      good number of the errors that table needs to capture happen exactly
 *      when there's no valid session to scope a client to (a crash on the
 *      sign-in screen, an expired token, a network failure before login).
 *
 * Do NOT use this client for ordinary business data CRUD - that would defeat
 * the RLS guarantee that is the core security property of this app.
 */
export function getServiceRoleClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
