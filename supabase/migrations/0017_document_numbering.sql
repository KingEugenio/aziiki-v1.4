-- Document numbering sequences: one row per (business, document_type),
-- incremented atomically via next_document_number() below so two concurrent
-- "create invoice" requests can never be handed the same number - a plain
-- "select max + 1 in application code" pattern (which is what
-- InvoiceReceiptBuilder.tsx does today, client-side) is a real double-
-- booking risk under concurrency.
create table public.document_numbering_sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_type text not null check (document_type in (
    'invoice', 'receipt', 'quotation', 'estimate', 'purchase_order',
    'delivery_note', 'credit_note', 'debit_note', 'contract',
    'proforma_invoice', 'expense_receipt', 'payment_voucher',
    'customer_statement', 'supplier_statement'
  )),
  prefix text not null default '',
  next_number integer not null default 1 check (next_number > 0),
  padding integer not null default 4 check (padding between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, document_type)
);

create index document_numbering_sequences_user_id_idx on public.document_numbering_sequences (user_id);
create index document_numbering_sequences_business_id_idx on public.document_numbering_sequences (business_id);

alter table public.document_numbering_sequences enable row level security;

create policy "document_numbering_sequences_select_own" on public.document_numbering_sequences for select using (user_id = auth.uid());
create policy "document_numbering_sequences_insert_own" on public.document_numbering_sequences for insert with check (user_id = auth.uid());
create policy "document_numbering_sequences_update_own" on public.document_numbering_sequences for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "document_numbering_sequences_delete_own" on public.document_numbering_sequences for delete using (user_id = auth.uid());

create trigger document_numbering_sequences_set_updated_at before update on public.document_numbering_sequences for each row execute function public.set_updated_at();
create trigger document_numbering_sequences_enforce_ownership before insert or update on public.document_numbering_sequences for each row execute function public.enforce_business_ownership();

-- Atomically reserves and returns the next formatted document number, e.g.
-- next_document_number('<business-id>', 'invoice') -> 'INV-0102'. Runs as
-- the calling user (not security definer) so RLS still applies to the
-- upsert - a caller can only ever advance their own business's sequence.
create or replace function public.next_document_number(
  p_business_id uuid,
  p_document_type text,
  p_default_prefix text default null
)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_number integer;
  v_padding integer;
begin
  insert into public.document_numbering_sequences (user_id, business_id, document_type, prefix)
  values (auth.uid(), p_business_id, p_document_type, coalesce(p_default_prefix, upper(left(p_document_type, 3))))
  on conflict (business_id, document_type) do nothing;

  update public.document_numbering_sequences
  set next_number = next_number + 1
  where business_id = p_business_id
    and document_type = p_document_type
  returning next_number - 1, prefix, padding into v_number, v_prefix, v_padding;

  return v_prefix || '-' || lpad(v_number::text, v_padding, '0');
end;
$$;
