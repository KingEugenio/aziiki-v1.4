-- Lets a customer's signature be captured (drawn or typed) against a
-- specific invoice/receipt/quotation and shown on that document from then
-- on. Scoped to the business owner capturing the signature in person
-- (e.g. at time of delivery/service) rather than a public unauthenticated
-- signing link - the latter is a materially bigger feature (needs a
-- tokenized public URL, its own auth-free route, expiry) and isn't built
-- here.
--
-- document_id intentionally has no foreign key: it can point at a row in
-- invoices, receipts, or quotations depending on document_type, and
-- Postgres foreign keys can't reference "whichever of three tables this
-- is". Ownership is still enforced (enforce_business_ownership below plus
-- the RLS policy), just not via a cross-table FK constraint.
create table public.document_signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_type text not null check (document_type in ('invoice', 'receipt', 'quotation')),
  document_id uuid not null,
  signer_name text not null check (char_length(trim(signer_name)) > 0),
  signature_kind text not null check (signature_kind in ('drawn', 'typed')),
  -- 'drawn' -> an SVG path string; 'typed' -> the typed name, rendered in a
  -- script font at display time (see SignatureCapture.tsx / DocumentBlockRenderer).
  signature_data text not null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index document_signatures_user_id_idx on public.document_signatures (user_id);
create index document_signatures_document_idx on public.document_signatures (document_type, document_id);

alter table public.document_signatures enable row level security;

create policy "document_signatures_select_own"
  on public.document_signatures for select
  using (user_id = auth.uid());

create policy "document_signatures_insert_own"
  on public.document_signatures for insert
  with check (user_id = auth.uid());

create policy "document_signatures_delete_own"
  on public.document_signatures for delete
  using (user_id = auth.uid());

-- No update policy: a signature is either replaced (delete + re-sign) or
-- left alone - there's no legitimate reason to mutate a captured signature
-- in place.

create trigger document_signatures_enforce_ownership
  before insert on public.document_signatures
  for each row execute function public.enforce_business_ownership();
