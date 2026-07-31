-- Durable, append-only security audit trail. Replaces the old in-memory
-- auditLogs[] array (which lost history on every restart and couldn't work
-- across multiple server instances).
--
-- Rows are written exclusively by the server using the Supabase SERVICE ROLE
-- key (see src/server/security/logSecurityEvent.ts) because failed-login
-- events happen before a session/JWT exists, so there is no user-scoped
-- client available yet to write with. Service role bypasses RLS on write,
-- which is why there is deliberately NO insert/update/delete policy for the
-- regular authenticated/anon roles below - only SELECT is exposed, and only
-- for a user's own rows.
create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  email text,
  action text not null, -- e.g. AUTH_LOGIN, AUTH_FAILURE, AUTH_LOCKOUT, PASSWORD_RESET_REQUESTED, MFA_ENROLLED
  details text,
  ip text,
  created_at timestamptz not null default now()
);

create index security_events_user_id_idx on public.security_events (user_id);
create index security_events_email_idx on public.security_events (email);
create index security_events_occurred_at_idx on public.security_events (occurred_at desc);

alter table public.security_events enable row level security;

create policy "security_events_select_own"
  on public.security_events for select
  using (user_id = auth.uid());

-- Deliberately no insert/update/delete policy here for authenticated/anon:
-- writes only ever happen via the service-role key from the server.
