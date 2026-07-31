---
name: verify
description: Drive the Aziiki app in a real browser to verify a frontend/backend change, without a real Supabase/Redis project.
---

# Verifying Aziiki changes

This app requires a real Supabase project (auth) and Upstash Redis
(caching/rate limiting) to run for real. Neither exists in the sandbox, so
full auth-gated E2E isn't possible here - use this recipe instead.

## 1. Boot the dev server with fake (but well-formed) env vars

`src/server/env.ts` only validates *shape* (valid URL, minimum key length),
not reachability, so the server boots fine and serves the SPA even though
Supabase/Redis calls will fail over the network:

```bash
NODE_ENV=development PORT=4321 \
SUPABASE_URL="https://fake-project.supabase.co" \
SUPABASE_ANON_KEY="fake_anon_key_1234567890123456789" \
SUPABASE_SERVICE_ROLE_KEY="fake_service_role_key_123456789012345" \
UPSTASH_REDIS_REST_URL="https://fake.upstash.io" \
UPSTASH_REDIS_REST_TOKEN="fake_upstash_token_1234567890" \
VITE_SUPABASE_URL="https://fake-project.supabase.co" \
VITE_SUPABASE_ANON_KEY="fake_anon_key_1234567890123456789" \
nohup npx tsx server.ts > /tmp/dev_verify.log 2>&1 &
```

There is no dotenv wiring - a `.env` file is NOT read by `tsx server.ts`;
env vars must be exported inline (as above) or via `node --env-file`.

## 2. Reach the real dashboard via Guest Mode

Logging in for real needs a live Supabase project. Guest Mode
(`isGuest` in `App.tsx`) runs the whole dashboard against local state with
no session - it's the only way to reach the real rendered app here.

- The onboarding flow (Ask/Aha/Commit) shows first on a fresh
  `localStorage`. Skip it by setting the completion flag before navigating
  (Playwright `page.addInitScript`):
  `window.localStorage.setItem("aziiki_onboarding_completed", "true")`
- Then click the "Skip as Guest" link on the auth screen.
- Main nav tab buttons have stable ids, e.g. `#tab-billing-btn` for
  Billing & PDFs (which renders `InvoiceReceiptBuilder`).

Caveat: Guest Mode's own local-only logic (invoices, receipts, etc.) skips
the backend entirely, but components like `TemplateGallery` /
`BrandKitSettings` / `BrandKit` always call the real `/api/*` routes
regardless of guest mode - those need step 3.

## 3. Mock `/api/*` at the network layer for anything backend-dependent

Since there's no real Supabase/Redis, intercept the specific routes a
feature needs with Playwright's `page.route()` and serve realistic JSON
fixtures. This still drives the real React component tree and real DOM via
real clicks - only the network boundary is faked, which is the honest
middle ground when there's no live backend to hit.

Chromium is pre-installed:
`executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"`
(add `args: ["--no-sandbox"]`). `playwright-core` isn't a persisted
dependency - `npm install --no-save playwright-core` first. Write test
scripts as `.cjs` (package.json has `"type": "module"`).

## Gotchas

- Background polling/sync calls unrelated to the feature under test will
  log `[unhandled route error] TypeError: fetch failed` / 500s in the
  server log - that's the fake Supabase/Redis DNS failing for calls you
  didn't intercept, not a bug in your change.
- For anything needing real Postgres behavior (RLS policies, triggers,
  atomic functions), there's a *separate* local PostgreSQL 16 cluster
  available (`pg_ctlcluster 16 main start`) - stub a minimal `auth` schema
  (`auth.users` table with a `raw_user_meta_data jsonb` column, plus an
  `auth.uid()` function reading a session GUC like
  `current_setting('app.current_user_id', true)::uuid`) and run the
  migrations in `supabase/migrations/` in order. Use
  `set role authenticated; set app.current_user_id = '<uuid>';` per test
  session to simulate different users and confirm RLS isolation.
