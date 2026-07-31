-- Real multi-user team access. Until now every table's RLS was strictly
-- "user_id = auth.uid()" - one owner per business, full stop. business_roles
-- (migration 0004) named Owner/Admin/Accountant/Staff but was explicitly
-- documented as "informational... NOT wired to real authentication", and
-- nothing in the frontend even reads it. This migration makes those roles
-- real:
--   Owner      - implicit via businesses.user_id, full control including
--                deleting the business and managing all members.
--   Admin      - full CRUD on business data, can invite/remove
--                Accountant/Staff members. Cannot delete the business or
--                manage other Admins.
--   Accountant - full CRUD on business data. Cannot manage team members.
--   Staff      - can create/view/update business data but NOT delete it -
--                a safety default so junior staff can't destroy records.
--                Cannot manage team members.
--
-- business_roles is left untouched - it's a separate, still-informational
-- team roster/contact-list feature (no frontend UI reads or writes it
-- today), independent of the real access this migration grants.

create table public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  member_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('Admin', 'Accountant', 'Staff')),
  invited_by uuid not null references auth.users (id) on delete cascade,
  invited_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, member_user_id)
);

create index business_memberships_business_id_idx on public.business_memberships (business_id);
create index business_memberships_member_user_id_idx on public.business_memberships (member_user_id);

alter table public.business_memberships enable row level security;

-- Returns the caller's effective role for a business: 'Owner' if they own
-- it, otherwise their business_memberships role, otherwise null (no
-- access). security definer so it can read businesses/business_memberships
-- regardless of the caller's own RLS visibility into those tables - without
-- this, calling it from another table's RLS policy would recurse into
-- RLS-restricted reads and see nothing, since the caller's own row might not
-- be visible to themselves yet at policy-evaluation time.
create or replace function public.business_role_for(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.businesses b
      where b.id = p_business_id and b.user_id = auth.uid()
    ) then 'Owner'
    else (
      select bm.role from public.business_memberships bm
      where bm.business_id = p_business_id and bm.member_user_id = auth.uid()
    )
  end;
$$;

create or replace function public.has_business_access(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.business_role_for(p_business_id) is not null;
$$;

-- select: the member sees their own row (so the UI can show "your role"),
-- the owner sees their whole roster, and Admins see it to manage the team.
create policy "business_memberships_select"
  on public.business_memberships for select
  using (
    member_user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
    or public.business_role_for(business_id) = 'Admin'
  );

-- insert/update (invite, change role): owner or Admin only. This is the
-- actual access control for who can manage a team - enforced by Postgres
-- itself, not just hidden in application code.
create policy "business_memberships_insert"
  on public.business_memberships for insert
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
    or public.business_role_for(business_id) = 'Admin'
  );

create policy "business_memberships_update"
  on public.business_memberships for update
  using (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
    or public.business_role_for(business_id) = 'Admin'
  )
  with check (
    exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
    or public.business_role_for(business_id) = 'Admin'
  );

-- delete (remove a member): owner or Admin, or a member removing themselves
-- ("leave this business").
create policy "business_memberships_delete"
  on public.business_memberships for delete
  using (
    member_user_id = auth.uid()
    or exists (select 1 from public.businesses b where b.id = business_id and b.user_id = auth.uid())
    or public.business_role_for(business_id) = 'Admin'
  );

create trigger business_memberships_set_updated_at before update on public.business_memberships for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Patch the two "does business_id belong to user_id" ownership triggers to
-- also accept a real team member, not just the exact owner. This is the
-- single change that lets every table already using these two triggers
-- (businesses, business_partners, business_shareholders, customers,
-- transactions, invoices, receipts, quotations, investments, assets, goals,
-- debts, inventory, brand_kits, purchase_orders, document_signatures,
-- document_numbering_sequences, document_templates) accept inserts/updates
-- from any team member without touching each table's trigger individually.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_business_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.business_id is not null then
    if not exists (
      select 1 from public.businesses b
      where b.id = new.business_id and b.user_id = new.user_id
    ) and not exists (
      select 1 from public.business_memberships bm
      where bm.business_id = new.business_id and bm.member_user_id = new.user_id
    ) then
      raise exception 'business_id % does not belong to user %', new.business_id, new.user_id
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_template_business_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.business_id is not null then
    if not exists (
      select 1 from public.businesses b
      where b.id = new.business_id and b.user_id = new.user_id
    ) and not exists (
      select 1 from public.business_memberships bm
      where bm.business_id = new.business_id and bm.member_user_id = new.user_id
    ) then
      raise exception 'business_id % does not belong to user %', new.business_id, new.user_id
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Same relaxation for the three "item belongs to a parent document, which
-- belongs to a business" ownership triggers - these check the parent's
-- business_id rather than user_id directly, since a team member creating a
-- line item on someone else's invoice is exactly the case this migration
-- exists to allow.
create or replace function public.enforce_invoice_item_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_business_id uuid;
begin
  select i.user_id, i.business_id into v_owner_user_id, v_business_id
  from public.invoices i where i.id = new.invoice_id;

  if v_owner_user_id is null then
    raise exception 'invoice_id % does not exist', new.invoice_id using errcode = '42501';
  end if;

  if v_owner_user_id != new.user_id and not exists (
    select 1 from public.business_memberships bm
    where bm.business_id = v_business_id and bm.member_user_id = new.user_id
  ) then
    raise exception 'invoice_id % does not belong to user %', new.invoice_id, new.user_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_quotation_item_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_business_id uuid;
begin
  select q.user_id, q.business_id into v_owner_user_id, v_business_id
  from public.quotations q where q.id = new.quotation_id;

  if v_owner_user_id is null then
    raise exception 'quotation_id % does not exist', new.quotation_id using errcode = '42501';
  end if;

  if v_owner_user_id != new.user_id and not exists (
    select 1 from public.business_memberships bm
    where bm.business_id = v_business_id and bm.member_user_id = new.user_id
  ) then
    raise exception 'quotation_id % does not belong to user %', new.quotation_id, new.user_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_purchase_order_item_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_user_id uuid;
  v_business_id uuid;
begin
  select po.user_id, po.business_id into v_owner_user_id, v_business_id
  from public.purchase_orders po where po.id = new.purchase_order_id;

  if v_owner_user_id is null then
    raise exception 'purchase_order_id % does not exist', new.purchase_order_id using errcode = '42501';
  end if;

  if v_owner_user_id != new.user_id and not exists (
    select 1 from public.business_memberships bm
    where bm.business_id = v_business_id and bm.member_user_id = new.user_id
  ) then
    raise exception 'purchase_order_id % does not belong to user %', new.purchase_order_id, new.user_id
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- businesses: team members need to SELECT the business row itself (name,
-- currency, logo - the sidebar/dashboard depend on it), and Admins should be
-- able to update business settings. Deleting the business stays Owner-only -
-- an existential, irreversible action no team role should be able to trigger.
-- ---------------------------------------------------------------------------
drop policy "businesses_select_own" on public.businesses;
create policy "businesses_select_own"
  on public.businesses for select
  using (user_id = auth.uid() or public.has_business_access(id));

drop policy "businesses_update_own" on public.businesses;
create policy "businesses_update_own"
  on public.businesses for update
  using (user_id = auth.uid() or public.business_role_for(id) = 'Admin')
  with check (user_id = auth.uid() or public.business_role_for(id) = 'Admin');

-- ---------------------------------------------------------------------------
-- Straightforward business-scoped tables: select/update open to any team
-- member with access, delete restricted to Owner/Admin/Accountant (Staff
-- excluded by design). Insert policies are untouched - "with check
-- (user_id = auth.uid())" already allows a team member inserting their own
-- id; the ownership trigger above is what actually validates business
-- membership.
-- ---------------------------------------------------------------------------
drop policy "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "customers_update_own" on public.customers;
create policy "customers_update_own" on public.customers for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "customers_delete_own" on public.customers;
create policy "customers_delete_own" on public.customers for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "transactions_update_own" on public.transactions;
create policy "transactions_update_own" on public.transactions for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own" on public.transactions for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "invoices_update_own" on public.invoices;
create policy "invoices_update_own" on public.invoices for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "invoices_delete_own" on public.invoices;
create policy "invoices_delete_own" on public.invoices for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "invoice_items_select_own" on public.invoice_items;
create policy "invoice_items_select_own" on public.invoice_items for select using (
  user_id = auth.uid() or exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.has_business_access(i.business_id))
);
drop policy "invoice_items_update_own" on public.invoice_items;
create policy "invoice_items_update_own" on public.invoice_items for update using (
  user_id = auth.uid() or exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.has_business_access(i.business_id))
) with check (
  user_id = auth.uid() or exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.has_business_access(i.business_id))
);
drop policy "invoice_items_delete_own" on public.invoice_items;
create policy "invoice_items_delete_own" on public.invoice_items for delete using (
  user_id = auth.uid() or exists (select 1 from public.invoices i where i.id = invoice_items.invoice_id and public.business_role_for(i.business_id) in ('Admin', 'Accountant'))
);

drop policy "receipts_select_own" on public.receipts;
create policy "receipts_select_own" on public.receipts for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "receipts_update_own" on public.receipts;
create policy "receipts_update_own" on public.receipts for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "receipts_delete_own" on public.receipts;
create policy "receipts_delete_own" on public.receipts for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "quotations_select_own" on public.quotations;
create policy "quotations_select_own" on public.quotations for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "quotations_update_own" on public.quotations;
create policy "quotations_update_own" on public.quotations for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "quotations_delete_own" on public.quotations;
create policy "quotations_delete_own" on public.quotations for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "quotation_items_select_own" on public.quotation_items;
create policy "quotation_items_select_own" on public.quotation_items for select using (
  user_id = auth.uid() or exists (select 1 from public.quotations q where q.id = quotation_items.quotation_id and public.has_business_access(q.business_id))
);
drop policy "quotation_items_update_own" on public.quotation_items;
create policy "quotation_items_update_own" on public.quotation_items for update using (
  user_id = auth.uid() or exists (select 1 from public.quotations q where q.id = quotation_items.quotation_id and public.has_business_access(q.business_id))
) with check (
  user_id = auth.uid() or exists (select 1 from public.quotations q where q.id = quotation_items.quotation_id and public.has_business_access(q.business_id))
);
drop policy "quotation_items_delete_own" on public.quotation_items;
create policy "quotation_items_delete_own" on public.quotation_items for delete using (
  user_id = auth.uid() or exists (select 1 from public.quotations q where q.id = quotation_items.quotation_id and public.business_role_for(q.business_id) in ('Admin', 'Accountant'))
);

drop policy "purchase_orders_select_own" on public.purchase_orders;
create policy "purchase_orders_select_own" on public.purchase_orders for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "purchase_orders_update_own" on public.purchase_orders;
create policy "purchase_orders_update_own" on public.purchase_orders for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "purchase_orders_delete_own" on public.purchase_orders;
create policy "purchase_orders_delete_own" on public.purchase_orders for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "purchase_order_items_select_own" on public.purchase_order_items;
create policy "purchase_order_items_select_own" on public.purchase_order_items for select using (
  user_id = auth.uid() or exists (select 1 from public.purchase_orders po where po.id = purchase_order_items.purchase_order_id and public.has_business_access(po.business_id))
);
drop policy "purchase_order_items_update_own" on public.purchase_order_items;
create policy "purchase_order_items_update_own" on public.purchase_order_items for update using (
  user_id = auth.uid() or exists (select 1 from public.purchase_orders po where po.id = purchase_order_items.purchase_order_id and public.has_business_access(po.business_id))
) with check (
  user_id = auth.uid() or exists (select 1 from public.purchase_orders po where po.id = purchase_order_items.purchase_order_id and public.has_business_access(po.business_id))
);
drop policy "purchase_order_items_delete_own" on public.purchase_order_items;
create policy "purchase_order_items_delete_own" on public.purchase_order_items for delete using (
  user_id = auth.uid() or exists (select 1 from public.purchase_orders po where po.id = purchase_order_items.purchase_order_id and public.business_role_for(po.business_id) in ('Admin', 'Accountant'))
);

drop policy "investments_select_own" on public.investments;
create policy "investments_select_own" on public.investments for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "investments_update_own" on public.investments;
create policy "investments_update_own" on public.investments for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "investments_delete_own" on public.investments;
create policy "investments_delete_own" on public.investments for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "assets_select_own" on public.assets;
create policy "assets_select_own" on public.assets for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "assets_update_own" on public.assets;
create policy "assets_update_own" on public.assets for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "assets_delete_own" on public.assets;
create policy "assets_delete_own" on public.assets for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "debts_select_own" on public.debts;
create policy "debts_select_own" on public.debts for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "debts_update_own" on public.debts;
create policy "debts_update_own" on public.debts for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "debts_delete_own" on public.debts;
create policy "debts_delete_own" on public.debts for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "inventory_select_own" on public.inventory;
create policy "inventory_select_own" on public.inventory for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "inventory_update_own" on public.inventory;
create policy "inventory_update_own" on public.inventory for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "inventory_delete_own" on public.inventory;
create policy "inventory_delete_own" on public.inventory for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "brand_kits_select_own" on public.brand_kits;
create policy "brand_kits_select_own" on public.brand_kits for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "brand_kits_update_own" on public.brand_kits;
create policy "brand_kits_update_own" on public.brand_kits for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "brand_kits_delete_own" on public.brand_kits;
create policy "brand_kits_delete_own" on public.brand_kits for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "business_partners_select_own" on public.business_partners;
create policy "business_partners_select_own" on public.business_partners for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "business_partners_update_own" on public.business_partners;
create policy "business_partners_update_own" on public.business_partners for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "business_partners_delete_own" on public.business_partners;
create policy "business_partners_delete_own" on public.business_partners for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

drop policy "business_shareholders_select_own" on public.business_shareholders;
create policy "business_shareholders_select_own" on public.business_shareholders for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "business_shareholders_update_own" on public.business_shareholders;
create policy "business_shareholders_update_own" on public.business_shareholders for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "business_shareholders_delete_own" on public.business_shareholders;
create policy "business_shareholders_delete_own" on public.business_shareholders for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

-- Audit logs are append-only (no update/delete policy exists) - only select
-- needs extending so a team member can see their shared business's history.
drop policy "business_audit_logs_select_own" on public.business_audit_logs;
create policy "business_audit_logs_select_own" on public.business_audit_logs for select using (user_id = auth.uid() or public.has_business_access(business_id));

drop policy "document_numbering_sequences_select_own" on public.document_numbering_sequences;
create policy "document_numbering_sequences_select_own" on public.document_numbering_sequences for select using (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "document_numbering_sequences_update_own" on public.document_numbering_sequences;
create policy "document_numbering_sequences_update_own" on public.document_numbering_sequences for update using (user_id = auth.uid() or public.has_business_access(business_id)) with check (user_id = auth.uid() or public.has_business_access(business_id));
drop policy "document_numbering_sequences_delete_own" on public.document_numbering_sequences;
create policy "document_numbering_sequences_delete_own" on public.document_numbering_sequences for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

-- document_templates: preserve the existing is_system/is_public visibility
-- and the "is_system = false" guard on writes, just extend the "own"
-- half of each clause to cover team access.
drop policy "document_templates_select_visible" on public.document_templates;
create policy "document_templates_select_visible"
  on public.document_templates for select
  using (
    is_system = true or is_public = true or user_id = auth.uid()
    or (business_id is not null and public.has_business_access(business_id))
  );

drop policy "document_templates_update_own" on public.document_templates;
create policy "document_templates_update_own"
  on public.document_templates for update
  using (
    is_system = false and (
      user_id = auth.uid() or (business_id is not null and public.has_business_access(business_id))
    )
  )
  with check (
    is_system = false and (
      user_id = auth.uid() or (business_id is not null and public.has_business_access(business_id))
    )
  );

drop policy "document_templates_delete_own" on public.document_templates;
create policy "document_templates_delete_own"
  on public.document_templates for delete
  using (
    is_system = false and (
      user_id = auth.uid() or (business_id is not null and public.business_role_for(business_id) in ('Admin', 'Accountant'))
    )
  );

-- document_template_versions: append-only history, select only.
drop policy "document_template_versions_select_own" on public.document_template_versions;
create policy "document_template_versions_select_own"
  on public.document_template_versions for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.document_templates t
      where t.id = document_template_versions.template_id
        and t.business_id is not null
        and public.has_business_access(t.business_id)
    )
  );

-- document_signatures: no update policy exists (immutable once captured) -
-- extend select and delete only.
drop policy "document_signatures_select_own" on public.document_signatures;
create policy "document_signatures_select_own"
  on public.document_signatures for select
  using (user_id = auth.uid() or public.has_business_access(business_id));

drop policy "document_signatures_delete_own" on public.document_signatures;
create policy "document_signatures_delete_own"
  on public.document_signatures for delete
  using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

-- payment_transactions: insert is service-role/webhook-driven only (see
-- migration 0020's comment) - extend select only, so a team member can see
-- payment status for their shared business's invoices.
drop policy "payment_transactions_select_own" on public.payment_transactions;
create policy "payment_transactions_select_own"
  on public.payment_transactions for select
  using (user_id = auth.uid() or public.has_business_access(business_id));

-- personal_accounts and personal_budgets are deliberately NOT touched here -
-- they're an individual's own personal finance workspace, never shared with
-- a business team, regardless of what roles exist on any of their
-- businesses.
