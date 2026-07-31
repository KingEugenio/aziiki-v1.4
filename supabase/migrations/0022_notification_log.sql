-- Durable log of every notification FOFU has sent a user (payment received,
-- low stock, overdue invoice), backing both the emailed copy and the
-- in-app "check your email" banner. Writes always go through the
-- service-role client (src/server/notifications/notify.ts) because some
-- triggers - the overdue-invoice sweep in particular - run on a background
-- timer with no authenticated request/session to scope a client to, same
-- reasoning as security_events. Reading and marking-as-read, though, are
-- normal user actions, so (unlike security_events) this table does allow a
-- user to update their own rows - the API only ever sets read_at on that
-- path, never trusting the client with the other columns.
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in ('invoice_overdue', 'low_stock', 'payment_received')),
  reference_id uuid,
  title text not null,
  message text not null,
  email_sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_log_user_id_idx on public.notification_log (user_id);
create index notification_log_user_id_read_at_idx on public.notification_log (user_id, read_at);
-- Lets the overdue-invoice sweep cheaply check "have we already notified
-- about this invoice" without a per-row user_id filter.
create index notification_log_type_reference_id_idx on public.notification_log (type, reference_id);

alter table public.notification_log enable row level security;

create policy "notification_log_select_own"
  on public.notification_log for select
  using (user_id = auth.uid());

create policy "notification_log_update_own"
  on public.notification_log for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Deliberately no insert/delete policy for authenticated/anon - rows are
-- only ever created by the service-role client (see notify.ts).

create trigger notification_log_enforce_ownership
  before insert or update on public.notification_log
  for each row execute function public.enforce_business_ownership();
