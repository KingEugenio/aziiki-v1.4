create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  custom_client_name text, -- used when the invoice targets a one-off client not in the CRM
  invoice_number text not null,
  date date not null,
  due_date date not null,
  discount numeric(5, 2) not null default 0 check (discount >= 0 and discount <= 100),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Paid', 'Overdue')),
  partial_paid_amount numeric(14, 2) not null default 0 check (partial_paid_amount >= 0),
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_customer_or_custom_client check (customer_id is not null or custom_client_name is not null),
  unique (business_id, invoice_number)
);

create index invoices_user_id_idx on public.invoices (user_id);
create index invoices_business_id_idx on public.invoices (business_id);
create index invoices_customer_id_idx on public.invoices (customer_id);
create index invoices_business_id_status_idx on public.invoices (business_id, status);
create index invoices_business_id_date_idx on public.invoices (business_id, date desc);

alter table public.invoices enable row level security;

create policy "invoices_select_own" on public.invoices for select using (user_id = auth.uid());
create policy "invoices_insert_own" on public.invoices for insert with check (user_id = auth.uid());
create policy "invoices_update_own" on public.invoices for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invoices_delete_own" on public.invoices for delete using (user_id = auth.uid());

create trigger invoices_set_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create trigger invoices_enforce_ownership before insert or update on public.invoices for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- invoice_items (normalized line items - replaces the JSON items[] array)
-- ---------------------------------------------------------------------------
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  rate numeric(14, 2) not null default 0 check (rate >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index invoice_items_user_id_idx on public.invoice_items (user_id);

alter table public.invoice_items enable row level security;

create policy "invoice_items_select_own" on public.invoice_items for select using (user_id = auth.uid());
create policy "invoice_items_insert_own" on public.invoice_items for insert with check (user_id = auth.uid());
create policy "invoice_items_update_own" on public.invoice_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invoice_items_delete_own" on public.invoice_items for delete using (user_id = auth.uid());

create trigger invoice_items_set_updated_at before update on public.invoice_items for each row execute function public.set_updated_at();

-- invoice_items links to invoices, not businesses directly, so it needs its
-- own ownership check rather than the generic business trigger.
create or replace function public.enforce_invoice_item_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.invoices i
    where i.id = new.invoice_id
      and i.user_id = new.user_id
  ) then
    raise exception 'invoice_id % does not belong to user %', new.invoice_id, new.user_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger invoice_items_enforce_ownership before insert or update on public.invoice_items for each row execute function public.enforce_invoice_item_ownership();
