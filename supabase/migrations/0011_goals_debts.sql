-- Goals are strictly per-business (mirrors the original app's data model).
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in ('Revenue', 'Savings', 'Equipment', 'Expansion')),
  name text not null,
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  target_amount numeric(14, 2) not null check (target_amount >= 0),
  deadline date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_id_idx on public.goals (user_id);
create index goals_business_id_idx on public.goals (business_id);

alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals for select using (user_id = auth.uid());
create policy "goals_insert_own" on public.goals for insert with check (user_id = auth.uid());
create policy "goals_update_own" on public.goals for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals_delete_own" on public.goals for delete using (user_id = auth.uid());

create trigger goals_set_updated_at before update on public.goals for each row execute function public.set_updated_at();
create trigger goals_enforce_ownership before insert or update on public.goals for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- debts - user-level like investments/assets, optionally tagged to a business.
-- ---------------------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  creditor text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  interest_rate numeric(6, 2) not null default 0,
  due_date date not null,
  type text not null check (type in ('Loan', 'Supplier Credit', 'Overdraft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index debts_user_id_idx on public.debts (user_id);
create index debts_business_id_idx on public.debts (business_id);

alter table public.debts enable row level security;

create policy "debts_select_own" on public.debts for select using (user_id = auth.uid());
create policy "debts_insert_own" on public.debts for insert with check (user_id = auth.uid());
create policy "debts_update_own" on public.debts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "debts_delete_own" on public.debts for delete using (user_id = auth.uid());

create trigger debts_set_updated_at before update on public.debts for each row execute function public.set_updated_at();
create trigger debts_enforce_ownership before insert or update on public.debts for each row execute function public.enforce_business_ownership();
