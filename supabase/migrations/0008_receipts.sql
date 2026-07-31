create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  custom_client_name text,
  invoice_id uuid references public.invoices (id) on delete set null,
  receipt_number text not null,
  date date not null,
  description text,
  amount_paid numeric(14, 2) not null check (amount_paid >= 0),
  payment_method text not null check (payment_method in ('Mobile Money', 'Cash', 'Bank Transfer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipts_customer_or_custom_client check (customer_id is not null or custom_client_name is not null),
  unique (business_id, receipt_number)
);

create index receipts_user_id_idx on public.receipts (user_id);
create index receipts_business_id_idx on public.receipts (business_id);
create index receipts_customer_id_idx on public.receipts (customer_id);
create index receipts_invoice_id_idx on public.receipts (invoice_id);
create index receipts_business_id_date_idx on public.receipts (business_id, date desc);

alter table public.receipts enable row level security;

create policy "receipts_select_own" on public.receipts for select using (user_id = auth.uid());
create policy "receipts_insert_own" on public.receipts for insert with check (user_id = auth.uid());
create policy "receipts_update_own" on public.receipts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "receipts_delete_own" on public.receipts for delete using (user_id = auth.uid());

create trigger receipts_set_updated_at before update on public.receipts for each row execute function public.set_updated_at();
create trigger receipts_enforce_ownership before insert or update on public.receipts for each row execute function public.enforce_business_ownership();
