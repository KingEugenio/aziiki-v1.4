-- Phase C of the currency/localization redesign: manual exchange-rate
-- storage per business, so a document in a foreign currency can auto-fill
-- a sensible rate instead of always defaulting to 1 and forcing the user to
-- look it up and type it in every time.
--
-- Deliberately manual-only for now (a `source` column exists so a live-rate
-- provider can be layered in later without a schema change) - the provider
-- choice was explicitly deferred in the approved architecture, and a wrong
-- automatic rate is worse than no rate at all for a financial document.
create table public.business_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  currency text not null references public.currencies (code),
  rate_to_business_currency numeric(20, 10) not null check (rate_to_business_currency > 0),
  source text not null default 'manual' check (source in ('manual', 'live')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_id, currency)
);

create index business_exchange_rates_business_id_idx on public.business_exchange_rates (business_id);

alter table public.business_exchange_rates enable row level security;

-- Same read/write shape as the other business-scoped settings tables
-- (migration 0026): any team member can read, only Owner/Admin/Accountant
-- can write - a rate used to compute money owed is a financial control, not
-- a cosmetic preference.
create policy "business_exchange_rates_select_own" on public.business_exchange_rates
  for select using (user_id = auth.uid() or public.has_business_access(business_id));
create policy "business_exchange_rates_insert_own" on public.business_exchange_rates
  for insert with check (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));
create policy "business_exchange_rates_update_own" on public.business_exchange_rates
  for update using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'))
  with check (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));
create policy "business_exchange_rates_delete_own" on public.business_exchange_rates
  for delete using (user_id = auth.uid() or public.business_role_for(business_id) in ('Admin', 'Accountant'));

create trigger business_exchange_rates_set_updated_at before update on public.business_exchange_rates
  for each row execute function public.set_updated_at();
create trigger business_exchange_rates_enforce_ownership before insert or update on public.business_exchange_rates
  for each row execute function public.enforce_business_ownership();
