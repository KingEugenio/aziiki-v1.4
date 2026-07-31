create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  description text,
  payment_method text not null check (payment_method in ('Mobile Money', 'Cash', 'Bank Transfer')),
  proof_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_business_id_idx on public.transactions (business_id);
create index transactions_customer_id_idx on public.transactions (customer_id);
create index transactions_business_id_date_idx on public.transactions (business_id, date desc);
create index transactions_business_id_type_idx on public.transactions (business_id, type);
create index transactions_created_at_idx on public.transactions (created_at desc);

alter table public.transactions enable row level security;

create policy "transactions_select_own" on public.transactions for select using (user_id = auth.uid());
create policy "transactions_insert_own" on public.transactions for insert with check (user_id = auth.uid());
create policy "transactions_update_own" on public.transactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions_delete_own" on public.transactions for delete using (user_id = auth.uid());

create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger transactions_enforce_ownership before insert or update on public.transactions for each row execute function public.enforce_business_ownership();
