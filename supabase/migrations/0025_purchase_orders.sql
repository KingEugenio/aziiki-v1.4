-- Purchase Orders: a business documenting what it is buying FROM a
-- supplier - the opposite direction of an invoice (which documents what a
-- business is billing a customer). One of the 13 document types already
-- named in documentTypeField (server/validation/documentTemplates.ts) that
-- had no real table/UI behind it until now.
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_name text not null check (char_length(trim(supplier_name)) > 0),
  supplier_contact text,
  po_number text not null,
  date date not null,
  expected_delivery_date date,
  discount numeric(5, 2) not null default 0 check (discount >= 0 and discount <= 100),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Confirmed', 'Received', 'Cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, po_number)
);

create index purchase_orders_user_id_idx on public.purchase_orders (user_id);
create index purchase_orders_business_id_idx on public.purchase_orders (business_id);
create index purchase_orders_business_id_status_idx on public.purchase_orders (business_id, status);

alter table public.purchase_orders enable row level security;

create policy "purchase_orders_select_own" on public.purchase_orders for select using (user_id = auth.uid());
create policy "purchase_orders_insert_own" on public.purchase_orders for insert with check (user_id = auth.uid());
create policy "purchase_orders_update_own" on public.purchase_orders for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "purchase_orders_delete_own" on public.purchase_orders for delete using (user_id = auth.uid());

create trigger purchase_orders_set_updated_at before update on public.purchase_orders for each row execute function public.set_updated_at();
create trigger purchase_orders_enforce_ownership before insert or update on public.purchase_orders for each row execute function public.enforce_business_ownership();

-- ---------------------------------------------------------------------------
-- purchase_order_items
-- ---------------------------------------------------------------------------
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  rate numeric(14, 2) not null default 0 check (rate >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_order_items_purchase_order_id_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_user_id_idx on public.purchase_order_items (user_id);

alter table public.purchase_order_items enable row level security;

create policy "purchase_order_items_select_own" on public.purchase_order_items for select using (user_id = auth.uid());
create policy "purchase_order_items_insert_own" on public.purchase_order_items for insert with check (user_id = auth.uid());
create policy "purchase_order_items_update_own" on public.purchase_order_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "purchase_order_items_delete_own" on public.purchase_order_items for delete using (user_id = auth.uid());

create trigger purchase_order_items_set_updated_at before update on public.purchase_order_items for each row execute function public.set_updated_at();

create or replace function public.enforce_purchase_order_item_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.purchase_orders po
    where po.id = new.purchase_order_id
      and po.user_id = new.user_id
  ) then
    raise exception 'purchase_order_id % does not belong to user %', new.purchase_order_id, new.user_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger purchase_order_items_enforce_ownership before insert or update on public.purchase_order_items for each row execute function public.enforce_purchase_order_item_ownership();
