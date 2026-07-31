-- Phase D of the currency/localization redesign: a business's home
-- location (country + IANA timezone), used to detect when a user is
-- currently somewhere else (a different timezone than their business's
-- registered one) so the app can offer a session-only display-currency
-- switch instead of silently assuming the browser's locale is "home".
--
-- Nullable and unenforced deliberately - existing businesses have neither,
-- and the frontend auto-detects+prefills them once on first load rather
-- than the migration guessing wrong from nothing.
alter table public.businesses
  add column country_code text check (country_code is null or char_length(country_code) = 2),
  add column timezone text;
