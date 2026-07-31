-- Durable, append-only log of application errors: both server-side
-- exceptions (caught by the global Express error handler in server.ts) and
-- client-side reports (render crashes from ErrorBoundary, window
-- error/unhandledrejection events, and failed API calls - see
-- src/lib/errorReporting.ts and POST /api/errors/report in
-- src/server/routes/errors.ts). Same shape/reasoning as security_events
-- (migration 0013) and notification_log (migration 0022): rows are written
-- exclusively by the server using the SERVICE ROLE key, because a good
-- number of the errors this table needs to capture happen precisely when
-- there is no valid session to scope a user-bound client to (an expired
-- token, a network failure before login, a crash on the auth screen itself).
--
-- Deliberately no RLS select policy for authenticated/anon at all, unlike
-- security_events (which lets a user see their own auth history). There is
-- no legitimate product reason for a business owner to query this table
-- directly - it exists to feed an internal error-monitoring view (an admin
-- dashboard is scoped as later work; until one exists with real
-- role-based access control, this table stays fully server-only).
create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),

  -- 'critical' is reserved for 5xx/crash-class events that should also
  -- trigger the optional Slack/Discord/Telegram alert (see
  -- src/server/notifications/errorAlert.ts) - everything else is logged but
  -- doesn't page anyone.
  level text not null check (level in ('info', 'warning', 'error', 'critical')),
  source text not null check (
    source in ('server', 'error-boundary', 'window-error', 'unhandled-rejection', 'api-error')
  ),

  message text not null,
  stack text,
  component_stack text,

  -- Present for server-side entries (the route that failed) and for
  -- client-side api-error reports (which endpoint the failed fetch hit).
  method text,
  endpoint text,
  status_code int,

  -- Client-generated per-request id (see lib/api.ts), echoed back by the
  -- server's own error logging so a user's bug report / support ticket can
  -- be matched to the exact log row without exposing internals to them.
  request_id text,

  user_id uuid references auth.users (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,

  environment text not null,
  release_version text,
  user_agent text,
  url text,
  ip text,
  -- Not currently populated - would need a GeoIP lookup (by IP) wired in on
  -- the server side; left as a column so that's a config change later, not
  -- a schema change.
  country text,

  -- Free-form JSON for anything else worth keeping (screen size, online
  -- status, memory info where the browser exposes it, etc.) rather than
  -- growing this table's column list indefinitely for long-tail fields.
  extra jsonb,

  created_at timestamptz not null default now()
);

create index error_logs_occurred_at_idx on public.error_logs (occurred_at desc);
create index error_logs_level_idx on public.error_logs (level);
create index error_logs_source_idx on public.error_logs (source);
create index error_logs_user_id_idx on public.error_logs (user_id);
create index error_logs_business_id_idx on public.error_logs (business_id);
create index error_logs_request_id_idx on public.error_logs (request_id);

alter table public.error_logs enable row level security;

-- Deliberately no select/insert/update/delete policy for authenticated/anon:
-- every write happens via the service-role key from the server
-- (src/server/logging/logError.ts), and there is no client-facing read path
-- yet. Revisit when an admin dashboard with real role-based access exists.
