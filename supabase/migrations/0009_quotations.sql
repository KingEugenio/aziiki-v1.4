create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  custom_client_name text,
  quote_number text not null,
  date date not null,
  valid_until date not null,
  discount numeric(5, 2) not null default 0 check (discount >= 0 and discount <= 100),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Converted', 'Accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotations_customer_or_custom_client check (customer_id is not null or custom_client_name is not null),
  unique (business_id, quote_number)
);

create index quotations_user_id_idx on public.quotations (user_id);
create index quotations_business_id_idx on public.quotations (business_id);
create index quotations_customer_id_idx on public.quotations (customer_id);
create index quotations_business_id_status_idx on public.quotations (business_id, status);

alter table public.quotations enable row level security;

create policy "quotations_select_own" on public.quotations for select using (user_id = auth.uid());
create policy "quotations_insert_own" on public.quotations for insert with check (user_id = auth.uid());
create policy "quotations_update_own" on public.quotations for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quotations_delete_own" on public.quotations for delete using (user_id = auth.uid());

create trigger quotations_set_updated_at before update on public.quotations for each row execute function public.set_updated_at();
create trigger quotations_enforce_ownership before insert or update on public.quotations for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- quotation_items
-- ---------------------------------------------------------------------------
create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  rate numeric(14, 2) not null default 0 check (rate >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotation_items_quotation_id_idx on public.quotation_items (quotation_id);
create index quotation_items_user_id_idx on public.quotation_items (user_id);

alter table public.quotation_items enable row level security;

create policy "quotation_items_select_own" on public.quotation_items for select using (user_id = auth.uid());
create policy "quotation_items_insert_own" on public.quotation_items for insert with check (user_id = auth.uid());
create policy "quotation_items_update_own" on public.quotation_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quotation_items_delete_own" on public.quotation_items for delete using (user_id = auth.uid());

create trigger quotation_items_set_updated_at before update on public.quotation_items for each row execute function public.set_updated_at();

create or replace function public.enforce_quotation_item_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.quotations q
    where q.id = new.quotation_id
      and q.user_id = new.user_id
  ) then
    raise exception 'quotation_id % does not belong to user %', new.quotation_id, new.user_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger quotation_items_enforce_ownership before insert or update on public.quotation_items for each row execute function public.enforce_quotation_item_ownership();
