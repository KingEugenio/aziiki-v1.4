create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  email text,
  phone text,
  notes text,
  category text,
  avatar_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_user_id_idx on public.customers (user_id);
create index customers_business_id_idx on public.customers (business_id);
create index customers_email_idx on public.customers (email);
create index customers_business_id_name_idx on public.customers (business_id, name);

alter table public.customers enable row level security;

create policy "customers_select_own" on public.customers for select using (user_id = auth.uid());
create policy "customers_insert_own" on public.customers for insert with check (user_id = auth.uid());
create policy "customers_update_own" on public.customers for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers_delete_own" on public.customers for delete using (user_id = auth.uid());

create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger customers_enforce_ownership before insert or update on public.customers for each row execute function public.enforce_business_ownership();
