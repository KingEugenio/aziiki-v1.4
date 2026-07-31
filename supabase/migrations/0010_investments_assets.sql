-- Investments and assets are user-level "net worth" records: they may
-- optionally be tagged to a business, but survive that business being
-- deleted (business_id is nullable, ON DELETE SET NULL).

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  type text not null check (type in ('Treasury Bill', 'Mutual Fund', 'Fixed Deposit', 'Stock', 'Bond', 'Real Estate', 'Business Investment', 'Savings Account', 'SACCO/Cooperative')),
  name text not null,
  institution text,
  value numeric(14, 2) not null default 0 check (value >= 0),
  amount_invested numeric(14, 2) not null default 0 check (amount_invested >= 0),
  maturity_date date,
  expected_return_rate numeric(6, 2) not null default 0,
  date_acquired date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investments_user_id_idx on public.investments (user_id);
create index investments_business_id_idx on public.investments (business_id);

alter table public.investments enable row level security;

create policy "investments_select_own" on public.investments for select using (user_id = auth.uid());
create policy "investments_insert_own" on public.investments for insert with check (user_id = auth.uid());
create policy "investments_update_own" on public.investments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "investments_delete_own" on public.investments for delete using (user_id = auth.uid());

create trigger investments_set_updated_at before update on public.investments for each row execute function public.set_updated_at();
create trigger investments_enforce_ownership before insert or update on public.investments for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  name text not null,
  category text not null check (category in ('Machinery', 'Equipment', 'Vehicle', 'Real Estate', 'Computer/IT', 'Other')),
  purchase_date date not null,
  purchase_price numeric(14, 2) not null default 0 check (purchase_price >= 0),
  current_value numeric(14, 2) not null default 0 check (current_value >= 0),
  depreciation_method text check (depreciation_method in ('Straight Line', 'Double Declining', 'None')),
  useful_life_years integer check (useful_life_years > 0),
  salvage_value numeric(14, 2) check (salvage_value >= 0),
  maintenance_last_date date,
  maintenance_next_date date,
  maintenance_status text check (maintenance_status in ('Good', 'Needs Service', 'Overdue')),
  maintenance_notes text,
  documents_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assets_user_id_idx on public.assets (user_id);
create index assets_business_id_idx on public.assets (business_id);

alter table public.assets enable row level security;

create policy "assets_select_own" on public.assets for select using (user_id = auth.uid());
create policy "assets_insert_own" on public.assets for insert with check (user_id = auth.uid());
create policy "assets_update_own" on public.assets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "assets_delete_own" on public.assets for delete using (user_id = auth.uid());

create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger assets_enforce_ownership before insert or update on public.assets for each row execute function public.enforce_business_ownership();
