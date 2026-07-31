# AZIIKI Error Handling & Status System

This is the reference for the error-handling infrastructure built in this
pass. It's real, wired-up code — not mockups — but it's honestly scoped:
this document says exactly what's live, what's scaffolded-but-not-connected
(and why), and what's deliberately deferred.

## Why this doesn't look like "20 error pages"

Aziiki is a tab-based single-page app with **no URL router** (`App.tsx`
drives navigation with a plain `activeTab` string, not `react-router` or
similar). A classic "404 page," "500 page," "403 page" set assumes a
multi-page app where a broken URL is a real, distinct event. Here, most of
those HTTP-status scenarios only ever happen as the *result of an API call*
mid-session — a failed save, a stale reference, a permission check — not as
a navigation event. So instead of 15+ bespoke page components, this system
has two building blocks used everywhere:

- **`StatusScreen`** (`src/components/errors/StatusScreen.tsx`) — a single,
  config-driven full-panel takeover for the handful of situations where the
  *whole screen* genuinely needs to explain itself: signed out (401),
  forbidden (403), a render crash (500-equivalent), planned maintenance
  (503), and "you're offline and this needs a connection." Presets for each
  live in `statusPresets.tsx` so the copy is centralized and reviewable in
  one place.
- **`ToastProvider` / `useToast()`** (`src/components/errors/ToastProvider.tsx`)
  — the generic, queueable toast/alert surface for everything transient: a
  409 conflict, a 422 validation message, a 429 rate limit, a payment
  failure, an AI-advisor hiccup, a failed upload. This is the real-world
  equivalent of most of the "error pages" a traditional prompt would ask
  for — they're in-context, not full-screen, because navigating the whole
  app away from what the user was doing over a transient failure would be
  worse UX, not better.

## What's built and live

| Piece | File(s) | What it does |
|---|---|---|
| React error boundary | `src/components/errors/ErrorBoundary.tsx` | Catches render crashes. Two-tier: `main.tsx` wraps the whole app (fallback: reload), `App.tsx` wraps just the active tab's content (fallback: go to Dashboard) so one broken screen doesn't take the sidebar down with it. |
| Status screen system | `StatusScreen.tsx`, `statusPresets.tsx` | Session-expired, forbidden, maintenance, offline, generic server-error, rate-limited presets. |
| Toast system | `ToastProvider.tsx` | success/error/warning/info, queueable, auto-dismiss, mobile+desktop positioning, `aria-live`. |
| Empty states | `EmptyState.tsx` | Replaces 6 previously-duplicated, inconsistently-styled inline empty states across Dashboard/CRM/Inventory/Billing/Reports/Personal Workspace. |
| Offline detection | `src/lib/useOnlineStatus.ts`, `OfflineBanner.tsx` | `navigator.onLine` + event listeners, persistent banner, reconnect toast. |
| Client error reporting | `src/lib/errorReporting.ts` | `reportClientError()` (sendBeacon w/ fetch fallback, never throws) + `installGlobalErrorReporting()` (catches `window.onerror`/`unhandledrejection`, which a React boundary can't see). |
| API error normalization | `src/lib/api.ts` | Every request gets a client-generated `X-Request-Id`; distinguishes real network failures from non-2xx responses; `getFriendlyErrorMessage()` maps any error to safe, human copy (never a raw status code or stack trace); `getRetryAfterSeconds()` for 429s. |
| Maintenance mode | `server/env.ts` (`MAINTENANCE_MODE`), `server/routes/config.ts`, `App.tsx` | A manual operator switch — set the env var, restart, every user sees the maintenance `StatusScreen` instead of the app. Not an automated health check. |
| Server error logging | `supabase/migrations/0031_error_logs.sql`, `server/logging/logError.ts` | Durable, append-only, service-role-only table. The existing global Express error handler (`server.ts`) now persists every uncaught exception to it with full request context. |
| Clean API 404s | `server.ts` | Unmatched `/api/*` paths now return a real JSON 404 instead of silently falling through to the SPA's `index.html` with a 200. |
| Client crash reporting endpoint | `server/routes/errors.ts` (`POST /api/errors/report`) | Public (works even on the sign-in screen), zod-validated, feeds the same `error_logs` table. |
| Pluggable critical-error alerts | `server/notifications/errorAlert.ts` | Slack / Discord / Telegram, each independently optional via env vars, following the exact pattern already used for Paystack/Gemini/Resend in this codebase. |

Two real, previously-broken spots were fixed as a demonstration of the new
`getFriendlyErrorMessage()` helper: `InvoiceReceiptBuilder.tsx`'s payment
request and document-email-send flows were both dumping a caught error's
raw `.message` — including raw 5xx text straight from the server — directly
into a user-facing toast. That's exactly the "never expose raw technical
details" rule this whole system exists to enforce, and it's now fixed for
those two flows specifically.

## Turning on the alert channels (they aren't live)

No Slack workspace, Discord server, or Telegram bot is connected right now
— there's nothing to connect to without your own credentials, and this
sandbox has no network access to install a monitoring SDK even if it
wanted to. Every channel is a plain HTTPS webhook POST, no SDK needed:

- **Slack**: create an [Incoming Webhook](https://api.slack.com/messaging/webhooks), set `ERROR_ALERT_SLACK_WEBHOOK_URL`.
- **Discord**: Server Settings → Integrations → Webhooks → New Webhook, set `ERROR_ALERT_DISCORD_WEBHOOK_URL`.
- **Telegram**: message `@BotFather` to create a bot and get a token, message your new bot once so it's allowed to DM you, set `ERROR_ALERT_TELEGRAM_BOT_TOKEN` and `ERROR_ALERT_TELEGRAM_CHAT_ID`.
- **SMS**: not implemented — every provider (Twilio, etc.) needs a paid, provisioned phone number, unlike the three free webhook-based channels above. Add it the same way (`sendSmsAlert()` in `errorAlert.ts`) whenever you have one.

Set `RELEASE_VERSION` at deploy time (your CI commit SHA or a version tag)
so every log row and alert says exactly which deploy it came from.

## Where the bigger monitoring stack would plug in

The master brief asks about Sentry, Better Stack, LogRocket, Datadog,
Grafana, Prometheus, OpenTelemetry, Google Analytics, Microsoft Clarity,
Cloudflare Analytics, and Vercel Analytics. None of these are installed —
each needs its own account/DSN/API key that only you can generate, and this
sandbox has no npm registry access to add a new package even for a no-op
wiring. Here's exactly where each would go when you're ready, with zero
architecture changes needed:

- **Sentry**: `Sentry.init()` in `main.tsx` (before the `createRoot` call), then call `Sentry.captureException(error)` inside `ErrorBoundary.componentDidCatch` and inside `installGlobalErrorReporting()`'s two listeners in `errorReporting.ts` — right next to the existing `reportClientError()` calls, not instead of them (you'd want both: your own `error_logs` table for a full record, Sentry for its UI/alerting on top).
- **LogRocket**: `LogRocket.init()` in `main.tsx`; call `LogRocket.captureException(error)` at the same two call sites as Sentry above. Consider gating session recording behind a user consent flag given the Privacy Policy this same pass wrote.
- **Better Stack / other uptime monitors**: no code change at all — point it at your deployed URL from their dashboard. Consider adding a lightweight `GET /api/health` route if you want a real backend+DB check rather than just "does the homepage load."
- **Datadog / Grafana + Prometheus / OpenTelemetry**: these want structured metrics/traces, not just error events. The natural insertion point is `server.ts`'s request pipeline — an OpenTelemetry SDK's Express instrumentation auto-wraps every route; Datadog's Node agent does the same. `logError()` already centralizes error events, so exporting from there too is straightforward once one of these is installed.
- **Google Analytics / Microsoft Clarity / Cloudflare Analytics / Vercel Analytics**: these are page-view/behavior analytics, not error monitoring — add their script tag/SDK call in `main.tsx` or `index.html`. Note the current CSP in `server.ts` (`helmet` config) restricts `scriptSrc`/`connectSrc` to `'self'` and Supabase in production — any of these will need its origin added there or it'll be silently blocked.

## What's deferred (honest scope, not an oversight)

This pass built the **core infrastructure** — the pieces that pay for
themselves regardless of what specific error happens next: crash recovery,
offline handling, consistent toasts/empty-states, and a real logging +
alerting pipeline. What's genuinely still open:

1. **Migrating every existing local toast/notif pattern.** Several
   components (`CustomerCRM`, `InvoiceReceiptBuilder`, others) already have
   their own bespoke `notif`/`triggerToast` local state predating this
   system. Two real call sites were fixed to use the new
   `getFriendlyErrorMessage()` helper as a demonstration; a full sweep
   replacing every local pattern with the shared `ToastProvider` is real,
   valuable, mechanical work for a future pass.
2. **Auth error variants** (OTP expired, account locked, magic link
   expired, too many login attempts) — `AuthPortal.tsx` and the lockout
   logic in `server/security/loginLockout.ts` already exist and handle some
   of this; giving each scenario its own polished, on-brand copy (rather
   than whatever the existing flow currently shows) is unreviewed/deferred.
3. **Draft/form recovery** (auto-save in-progress invoices, restore on
   crash/reload) — no such persistence exists yet anywhere in the app.
4. **Internal error-analytics admin dashboard** — `error_logs` exists and
   is being written to, but there's no UI reading it yet, and meaningfully
   no "admin" role concept exists at the platform level to gate one. This
   is real, substantial, standalone work (its own screen, its own
   auth model) for a dedicated future pass.
5. **Import/export-specific error UI** (highlighting invalid CSV rows with
   a downloadable error report, etc.) — the CSV importer in `CustomerCRM.tsx`
   already has basic inline error handling; making it match the more
   detailed "highlight bad rows" spec from the brief is deferred.

## Accessibility & performance notes

- `StatusScreen`, `EmptyState`, and toasts all use semantic `role="status"` /
  `aria-live="polite"` and inherit the app's existing az-* focus/contrast
  tokens — no new color system was introduced.
- `Skeleton.tsx` (pre-existing) already sets `aria-busy="true"` with an
  `sr-only` label.
- Nothing in this system adds a new heavy dependency — `motion` (already a
  dependency) is reused for toast animation; everything else is plain React
  + the existing `az-*` CSS.
