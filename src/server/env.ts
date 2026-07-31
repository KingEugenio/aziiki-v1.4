import { z } from "zod";

// Every variable here is required for the app to function correctly and
// securely. There are NO fallback defaults for secrets: if one of these is
// missing, the process must refuse to start rather than silently run with
// an insecure or empty value.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().url().default(`http://localhost:${process.env.PORT ?? 3000}`),

  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(20, "SUPABASE_ANON_KEY is missing or looks truncated"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is missing or looks truncated"),

  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10, "UPSTASH_REDIS_REST_TOKEN is missing or looks truncated"),

  // Feature-flagged rather than fatal: the AI routes check for this at request
  // time and return a clear 503 if it's absent, so a missing key degrades one
  // feature instead of blocking the whole app from starting.
  GEMINI_API_KEY: z.string().optional(),

  // Same feature-flagged pattern as GEMINI_API_KEY: emailing invoices/receipts
  // is an optional feature. Missing this never blocks startup - the send-email
  // routes return a clear 503 and the frontend disables the button instead.
  RESEND_API_KEY: z.string().optional(),
  // Not a secret - just the "from" address invoice/receipt emails are sent
  // from. Must be on a domain verified in your Resend account.
  RESEND_FROM_EMAIL: z.string().default("Aziiki <no-reply@aziiki.com>"),

  // Same feature-flagged pattern as GEMINI_API_KEY/RESEND_API_KEY: accepting
  // Paystack payments is optional. Missing this never blocks startup - the
  // payment routes return a clear 503 and the frontend hides the "Request
  // Payment" button instead. Add your real secret key here before hosting;
  // it is never checked into source control.
  PAYSTACK_SECRET_KEY: z.string().optional(),

  // AZIIKI ERROR SYSTEM - critical-error alert channels. All optional, all
  // independently configurable, same feature-flagged pattern as everything
  // above: with none of these set, critical errors still get logged to the
  // error_logs table and to the console - they just don't page anyone.
  // Set any subset of these to enable that channel; see
  // src/server/notifications/errorAlert.ts. None of these are wired to a
  // real workspace/bot out of the box - they're config, not code, changes.
  ERROR_ALERT_SLACK_WEBHOOK_URL: z.string().url().optional(),
  ERROR_ALERT_DISCORD_WEBHOOK_URL: z.string().url().optional(),
  ERROR_ALERT_TELEGRAM_BOT_TOKEN: z.string().optional(),
  ERROR_ALERT_TELEGRAM_CHAT_ID: z.string().optional(),

  // Surfaced in every error_logs row and in every alert message, so "which
  // deploy is this from" is never a guess. Set this to your CI commit SHA or
  // version tag at deploy time; defaults to "dev" locally.
  RELEASE_VERSION: z.string().default("dev"),

  // AZIIKI ERROR SYSTEM - flip to "true" during planned maintenance to show
  // every user the maintenance StatusScreen instead of the app (see
  // /api/config/features and App.tsx). A manual switch, not an automated
  // health check - set it, deploy/restart, and unset it when you're done.
  MAINTENANCE_MODE: z.enum(["true", "false"]).default("false"),
  // Freeform, shown verbatim in the maintenance screen if set (e.g. "2:00 PM UTC").
  MAINTENANCE_ESTIMATED_RETURN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // Intentionally fatal: never fall back to an insecure default secret.
    // eslint-disable-next-line no-console
    console.error(
      `\n[FATAL] Refusing to start: invalid or missing environment configuration.\n${issues}\n\nCopy .env.example to .env and fill in every value before starting the server.\n`
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
