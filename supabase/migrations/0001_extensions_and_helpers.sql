-- FOFU: extensions and shared trigger helpers
-- Run once, before any other migration.

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Generic updated_at stamper, attached to every table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Defense-in-depth: whenever a row carries both user_id and business_id,
-- verify the referenced business actually belongs to that same user_id.
-- This stops a bug (or a compromised client) from attaching a record to
-- someone else's business even though RLS already restricts user_id itself.
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
      where b.id = new.business_id
        and b.user_id = new.user_id
    ) then
      raise exception 'business_id % does not belong to user %', new.business_id, new.user_id
        using errcode = '42501'; -- insufficient_privilege
    end if;
  end if;
  return new;
end;
$$;
