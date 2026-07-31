-- Businesses (and personal workspaces, which are just businesses with
-- is_personal = true). One owner per business for v1 - see migration notes
-- in README for how to extend to multi-user membership later.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  industry text,
  logo text,
  primary_color text,
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  currency text not null default 'GHS' check (char_length(currency) = 3),
  description text,
  business_type text check (business_type in ('Sole Proprietor', 'Partnership', 'Company')),
  allow_financial_approvals boolean not null default false,
  is_personal boolean not null default false,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_user_id_idx on public.businesses (user_id);
create index businesses_user_id_created_at_idx on public.businesses (user_id, created_at desc);

alter table public.businesses enable row level security;

create policy "businesses_select_own"
  on public.businesses for select
  using (user_id = auth.uid());

create policy "businesses_insert_own"
  on public.businesses for insert
  with check (user_id = auth.uid());

create policy "businesses_update_own"
  on public.businesses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "businesses_delete_own"
  on public.businesses for delete
  using (user_id = auth.uid());

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();
