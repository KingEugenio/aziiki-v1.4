-- Document Templates: powers the Template Gallery, the drag-and-drop
-- editor, and (later) the Template Marketplace. `is_system` rows are
-- FOFU-provided starter templates (seeded via the service-role key, never
-- user-writable); everything else is a business's own custom template.
--
-- Marketplace readiness (Part 7 of the roadmap) is designed in from the
-- start via is_public/price_cents/creator attribution, even though no
-- storefront UI reads them yet - adding that UI later needs no schema
-- change, just new routes/screens.
create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete cascade,

  name text not null check (char_length(trim(name)) > 0),
  description text,
  document_type text not null check (document_type in (
    'invoice', 'receipt', 'quotation', 'estimate', 'purchase_order',
    'delivery_note', 'credit_note', 'debit_note', 'contract',
    'proforma_invoice', 'expense_receipt', 'payment_voucher',
    'customer_statement', 'supplier_statement'
  )),
  category text not null check (category in (
    'Corporate', 'Minimal', 'Luxury', 'Modern', 'Creative', 'African Inspired',
    'Fashion', 'Photography', 'Construction', 'Restaurant', 'Retail', 'Medical',
    'Legal', 'Technology', 'Education', 'Wholesale', 'Manufacturing',
    'Real Estate', 'Hospitality'
  )),

  -- The actual design definition: colors, fonts, block layout, placeholder
  -- bindings (e.g. {{business.name}}, {{customer.address}}). Kept as jsonb
  -- rather than a fixed column set so the drag-and-drop editor can evolve
  -- the block schema without a migration every time.
  layout_config jsonb not null default '{}'::jsonb,
  thumbnail_url text,

  tags text[] not null default '{}',
  folder text,
  is_favorite boolean not null default false,

  is_system boolean not null default false,
  source_format text check (source_format in ('native', 'pdf', 'image', 'svg', 'html', 'docx')),

  -- Marketplace readiness (not yet exposed in the UI - see migration note above).
  is_public boolean not null default false,
  price_cents integer check (price_cents is null or price_cents >= 0),
  currency text default 'USD',

  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint document_templates_owner_or_system check (
    is_system = true or (user_id is not null and business_id is not null)
  )
);

create index document_templates_user_id_idx on public.document_templates (user_id);
create index document_templates_business_id_idx on public.document_templates (business_id);
create index document_templates_document_type_idx on public.document_templates (document_type);
create index document_templates_category_idx on public.document_templates (category);
create index document_templates_is_system_idx on public.document_templates (is_system);
create index document_templates_tags_idx on public.document_templates using gin (tags);

alter table public.document_templates enable row level security;

-- Every signed-in user can see FOFU's built-in templates and (later) public
-- marketplace listings, in addition to their own.
create policy "document_templates_select_visible"
  on public.document_templates for select
  using (is_system = true or is_public = true or user_id = auth.uid());

create policy "document_templates_insert_own"
  on public.document_templates for insert
  with check (user_id = auth.uid() and is_system = false);

create policy "document_templates_update_own"
  on public.document_templates for update
  using (user_id = auth.uid() and is_system = false)
  with check (user_id = auth.uid() and is_system = false);

create policy "document_templates_delete_own"
  on public.document_templates for delete
  using (user_id = auth.uid() and is_system = false);

create trigger document_templates_set_updated_at before update on public.document_templates for each row execute function public.set_updated_at();

-- Only check business ownership when a business_id is actually set (system
-- templates have neither user_id nor business_id).
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
    ) then
      raise exception 'business_id % does not belong to user %', new.business_id, new.user_id
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger document_templates_enforce_ownership
  before insert or update on public.document_templates
  for each row execute function public.enforce_template_business_ownership();

-- ---------------------------------------------------------------------------
-- document_template_versions - version history (Part 12: security requires
-- every template edit to be recoverable, not just the latest state).
-- ---------------------------------------------------------------------------
create table public.document_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.document_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null,
  layout_config jsonb not null,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

create index document_template_versions_template_id_idx on public.document_template_versions (template_id);

alter table public.document_template_versions enable row level security;

create policy "document_template_versions_select_own"
  on public.document_template_versions for select
  using (user_id = auth.uid());

create policy "document_template_versions_insert_own"
  on public.document_template_versions for insert
  with check (user_id = auth.uid());

-- Version history is append-only: no update/delete policy for regular users.

create or replace function public.enforce_template_version_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.document_templates t
    where t.id = new.template_id and t.user_id = new.user_id
  ) then
    raise exception 'template_id % does not belong to user %', new.template_id, new.user_id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger document_template_versions_enforce_ownership
  before insert on public.document_template_versions
  for each row execute function public.enforce_template_version_ownership();
