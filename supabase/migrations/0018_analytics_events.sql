-- Product analytics event log (Part 9: usage tracking, feature adoption,
-- funnels, admin dashboards). High write-volume, read almost never by end
-- users - only by an internal admin dashboard - so writes go exclusively
-- through the service-role key from a dedicated ingestion endpoint (not
-- built yet - see roadmap), the same pattern already used for
-- security_events, rather than granting broad insert access to every
-- authenticated/anon client.
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  business_id uuid references public.businesses (id) on delete set null,
  session_id text not null,
  event_name text not null,
  event_category text not null check (event_category in (
    'navigation', 'document', 'template', 'engagement', 'onboarding',
    'error', 'performance', 'sharing', 'sync'
  )),
  properties jsonb not null default '{}'::jsonb,
  device_type text check (device_type in ('mobile', 'tablet', 'desktop')),
  country text,
  app_version text,
  created_at timestamptz not null default now()
);

-- Query patterns this needs to serve well: "events for this user/business
-- over time" (retention/cohorts), "count of this event name over time"
-- (feature adoption, funnels), and cheap admin-dashboard aggregation.
create index analytics_events_user_id_idx on public.analytics_events (user_id);
create index analytics_events_business_id_idx on public.analytics_events (business_id);
create index analytics_events_event_name_occurred_at_idx on public.analytics_events (event_name, occurred_at desc);
create index analytics_events_session_id_idx on public.analytics_events (session_id);
create index analytics_events_occurred_at_idx on public.analytics_events (occurred_at desc);
create index analytics_events_properties_idx on public.analytics_events using gin (properties);

alter table public.analytics_events enable row level security;

-- A user may see their own event history (e.g. a future "your activity"
-- page); nothing broader. No insert/update/delete policy for
-- authenticated/anon - only the service-role ingestion endpoint writes here.
create policy "analytics_events_select_own"
  on public.analytics_events for select
  using (user_id = auth.uid());
