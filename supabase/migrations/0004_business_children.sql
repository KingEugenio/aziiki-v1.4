-- Child tables that hang off a business: partners, shareholders, informational
-- team roles, audit log entries, and (for personal workspaces) accounts/budgets.
-- Each carries a denormalized user_id so RLS never needs a join - it just
-- checks user_id = auth.uid(), same as every other table. The
-- enforce_business_ownership trigger keeps that denormalized user_id honest.

-- ---------------------------------------------------------------------------
-- business_partners
-- ---------------------------------------------------------------------------
create table public.business_partners (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  ownership_percentage numeric(5, 2) not null default 0 check (ownership_percentage >= 0 and ownership_percentage <= 100),
  capital_contribution numeric(14, 2) not null default 0 check (capital_contribution >= 0),
  withdrawals numeric(14, 2) not null default 0 check (withdrawals >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_partners_business_id_idx on public.business_partners (business_id);
create index business_partners_user_id_idx on public.business_partners (user_id);

alter table public.business_partners enable row level security;

create policy "business_partners_select_own" on public.business_partners for select using (user_id = auth.uid());
create policy "business_partners_insert_own" on public.business_partners for insert with check (user_id = auth.uid());
create policy "business_partners_update_own" on public.business_partners for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "business_partners_delete_own" on public.business_partners for delete using (user_id = auth.uid());

create trigger business_partners_set_updated_at before update on public.business_partners for each row execute function public.set_updated_at();
create trigger business_partners_enforce_ownership before insert or update on public.business_partners for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- business_shareholders
-- ---------------------------------------------------------------------------
create table public.business_shareholders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  shares_count integer not null default 0 check (shares_count >= 0),
  equity_value numeric(14, 2) not null default 0 check (equity_value >= 0),
  capital_contribution numeric(14, 2) not null default 0 check (capital_contribution >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_shareholders_business_id_idx on public.business_shareholders (business_id);
create index business_shareholders_user_id_idx on public.business_shareholders (user_id);

alter table public.business_shareholders enable row level security;

create policy "business_shareholders_select_own" on public.business_shareholders for select using (user_id = auth.uid());
create policy "business_shareholders_insert_own" on public.business_shareholders for insert with check (user_id = auth.uid());
create policy "business_shareholders_update_own" on public.business_shareholders for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "business_shareholders_delete_own" on public.business_shareholders for delete using (user_id = auth.uid());

create trigger business_shareholders_set_updated_at before update on public.business_shareholders for each row execute function public.set_updated_at();
create trigger business_shareholders_enforce_ownership before insert or update on public.business_shareholders for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- business_roles (informational team-role records - see migration notes;
-- these are NOT wired to real authentication for other users in v1)
-- ---------------------------------------------------------------------------
create table public.business_roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('Owner', 'Admin', 'Accountant', 'Staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_roles_business_id_idx on public.business_roles (business_id);
create index business_roles_user_id_idx on public.business_roles (user_id);
create index business_roles_email_idx on public.business_roles (email);

alter table public.business_roles enable row level security;

create policy "business_roles_select_own" on public.business_roles for select using (user_id = auth.uid());
create policy "business_roles_insert_own" on public.business_roles for insert with check (user_id = auth.uid());
create policy "business_roles_update_own" on public.business_roles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "business_roles_delete_own" on public.business_roles for delete using (user_id = auth.uid());

create trigger business_roles_set_updated_at before update on public.business_roles for each row execute function public.set_updated_at();
create trigger business_roles_enforce_ownership before insert or update on public.business_roles for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- business_audit_logs (durable replacement for the old in-memory auditLogs[])
-- ---------------------------------------------------------------------------
create table public.business_audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  user_name text not null,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

create index business_audit_logs_business_id_idx on public.business_audit_logs (business_id);
create index business_audit_logs_user_id_idx on public.business_audit_logs (user_id);
create index business_audit_logs_occurred_at_idx on public.business_audit_logs (occurred_at desc);

alter table public.business_audit_logs enable row level security;

create policy "business_audit_logs_select_own" on public.business_audit_logs for select using (user_id = auth.uid());
create policy "business_audit_logs_insert_own" on public.business_audit_logs for insert with check (user_id = auth.uid());
-- Audit log rows are append-only: no update/delete policy for regular users.

create trigger business_audit_logs_enforce_ownership before insert on public.business_audit_logs for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- personal_accounts (wallets/accounts inside a personal, is_personal=true, workspace)
-- ---------------------------------------------------------------------------
create table public.personal_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null check (type in ('MTN Mobile Money', 'Telecel Cash', 'AirtelTigo Money', 'Bank Account', 'Cash Wallet', 'Savings Account')),
  initial_balance numeric(14, 2) not null default 0,
  balance numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_accounts_business_id_idx on public.personal_accounts (business_id);
create index personal_accounts_user_id_idx on public.personal_accounts (user_id);

alter table public.personal_accounts enable row level security;

create policy "personal_accounts_select_own" on public.personal_accounts for select using (user_id = auth.uid());
create policy "personal_accounts_insert_own" on public.personal_accounts for insert with check (user_id = auth.uid());
create policy "personal_accounts_update_own" on public.personal_accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "personal_accounts_delete_own" on public.personal_accounts for delete using (user_id = auth.uid());

create trigger personal_accounts_set_updated_at before update on public.personal_accounts for each row execute function public.set_updated_at();
create trigger personal_accounts_enforce_ownership before insert or update on public.personal_accounts for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- personal_budgets
-- ---------------------------------------------------------------------------
create table public.personal_budgets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  limit_amount numeric(14, 2) not null default 0 check (limit_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_budgets_business_id_idx on public.personal_budgets (business_id);
create index personal_budgets_user_id_idx on public.personal_budgets (user_id);

alter table public.personal_budgets enable row level security;

create policy "personal_budgets_select_own" on public.personal_budgets for select using (user_id = auth.uid());
create policy "personal_budgets_insert_own" on public.personal_budgets for insert with check (user_id = auth.uid());
create policy "personal_budgets_update_own" on public.personal_budgets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "personal_budgets_delete_own" on public.personal_budgets for delete using (user_id = auth.uid());

create trigger personal_budgets_set_updated_at before update on public.personal_budgets for each row execute function public.set_updated_at();
create trigger personal_budgets_enforce_ownership before insert or update on public.personal_budgets for each row execute function public.enforce_business_ownership();
