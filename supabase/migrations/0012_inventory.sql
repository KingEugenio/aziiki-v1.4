create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  sku text,
  quantity numeric(12, 2) not null default 0 check (quantity >= 0),
  min_stock_alert numeric(12, 2) not null default 0 check (min_stock_alert >= 0),
  unit_cost numeric(14, 2) not null default 0 check (unit_cost >= 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  supplier_name text,
  supplier_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index inventory_business_id_sku_idx on public.inventory (business_id, sku) where sku is not null and sku <> '';
create index inventory_user_id_idx on public.inventory (user_id);
create index inventory_business_id_idx on public.inventory (business_id);

alter table public.inventory enable row level security;

create policy "inventory_select_own" on public.inventory for select using (user_id = auth.uid());
create policy "inventory_insert_own" on public.inventory for insert with check (user_id = auth.uid());
create policy "inventory_update_own" on public.inventory for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "inventory_delete_own" on public.inventory for delete using (user_id = auth.uid());

create trigger inventory_set_updated_at before update on public.inventory for each row execute function public.set_updated_at();
create trigger inventory_enforce_ownership before insert or update on public.inventory for each row execute function public.enforce_business_ownership();
