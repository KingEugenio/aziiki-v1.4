-- Feedback / success-story submissions from the "Share Feedback" form in
-- AdMonetizationHub.tsx. Previously this form only updated local React
-- state and never persisted anywhere - this table is the fix.
create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index feedback_submissions_user_id_idx on public.feedback_submissions (user_id);
create index feedback_submissions_created_at_idx on public.feedback_submissions (created_at desc);

alter table public.feedback_submissions enable row level security;

-- Any authenticated user can insert a row, but only as themselves - the
-- request-scoped Supabase client (see src/server/routes/feedback.ts)
-- always sets user_id to the caller's own auth.uid(), and this policy
-- rejects anything else.
create policy "feedback_submissions_insert_own"
  on public.feedback_submissions for insert
  to authenticated
  with check (user_id = auth.uid());

-- Deliberately no select/update/delete policy for authenticated/anon:
-- submitters should not be able to read back other users' feedback (or
-- even their own, through this table - there is no "my feedback history"
-- feature). Only the service-role key (which bypasses RLS) can read these,
-- e.g. from an internal admin view.
