-- Tracks Paystack payment attempts against an invoice (or a standalone
-- payment request). Two very different write paths touch this table:
--
--   1. POST /api/payments/paystack/initialize (requireAuth) inserts the
--      initial "pending" row using the caller's own user-scoped Supabase
--      client, so the normal user_id = auth.uid() RLS policy covers it.
--   2. POST /api/payments/paystack/webhook (public - Paystack calls this
--      directly, there is no user session at all) updates that row to
--      success/failed using the SERVICE ROLE client, the same pattern
--      already used for security_events. That is why there is deliberately
--      NO update/delete policy below for the authenticated/anon roles -
--      only the service role (which bypasses RLS) ever transitions status.
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  reference text not null unique,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'GHS' check (char_length(currency) = 3),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'abandoned')),
  channel text,
  gateway_response text,
  paystack_transaction_id text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_transactions_user_id_idx on public.payment_transactions (user_id);
create index payment_transactions_business_id_idx on public.payment_transactions (business_id);
create index payment_transactions_invoice_id_idx on public.payment_transactions (invoice_id);
create index payment_transactions_status_idx on public.payment_transactions (status);

alter table public.payment_transactions enable row level security;

create policy "payment_transactions_select_own"
  on public.payment_transactions for select
  using (user_id = auth.uid());

create policy "payment_transactions_insert_own"
  on public.payment_transactions for insert
  with check (user_id = auth.uid());

-- Deliberately no update/delete policy for authenticated/anon: once a
-- transaction is created, only the Paystack webhook (via the service-role
-- client) is allowed to transition its status - see paymentsWebhook.ts.

create trigger payment_transactions_set_updated_at
  before update on public.payment_transactions
  for each row execute function public.set_updated_at();

create trigger payment_transactions_enforce_ownership
  before insert or update on public.payment_transactions
  for each row execute function public.enforce_business_ownership();
