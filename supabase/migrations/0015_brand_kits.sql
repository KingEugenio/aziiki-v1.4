-- Brand Kit: the single source of truth every generated document (invoice,
-- receipt, quotation, etc.) inherits its branding from. One kit per
-- business for now (kept as its own table, not columns on `businesses`,
-- so it can grow - multiple kits per business - without a breaking schema
-- change later).
create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null unique references public.businesses (id) on delete cascade,

  logo_url text,
  dark_logo_url text,
  light_logo_url text,
  watermark_url text,

  primary_color text not null default '#102A43',
  secondary_color text not null default '#006837',
  accent_color text not null default '#F59E0B',
  font_family text not null default 'Inter',

  registration_number text,
  tax_id text,
  vat_number text,
  address text,
  phone text,
  email text,
  website text,
  social_links jsonb not null default '{}'::jsonb,

  default_payment_methods jsonb not null default '[]'::jsonb,
  invoice_footer_text text,
  receipt_footer_text text,
  legal_disclaimer text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_kits_user_id_idx on public.brand_kits (user_id);
create index brand_kits_business_id_idx on public.brand_kits (business_id);

alter table public.brand_kits enable row level security;

create policy "brand_kits_select_own" on public.brand_kits for select using (user_id = auth.uid());
create policy "brand_kits_insert_own" on public.brand_kits for insert with check (user_id = auth.uid());
create policy "brand_kits_update_own" on public.brand_kits for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "brand_kits_delete_own" on public.brand_kits for delete using (user_id = auth.uid());

create trigger brand_kits_set_updated_at before update on public.brand_kits for each row execute function public.set_updated_at();
create trigger brand_kits_enforce_ownership before insert or update on public.brand_kits for each row execute function public.enforce_business_ownership();
