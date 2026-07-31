-- Phase B of the currency/localization redesign: per-document currency.
--
-- Every financial document now snapshots its own currency plus the exchange
-- rate to the business's currency AT THE TIME the document was created. This
-- is the "historical accuracy" pattern - later exchange-rate refreshes (or
-- the business changing its own currency) must never retroactively alter
-- what a past invoice/receipt/quote/PO/transaction says it was worth. Only
-- new documents pick up new rates.
--
-- exchange_rate_to_business_currency is "1 unit of this document's currency
-- equals N units of the business's currency". A document issued in the
-- business's own currency always has rate = 1.
--
-- goals and debts get a simpler treatment: a single fixed `currency` column
-- (the target/denomination currency), not a rate column, since they are
-- ongoing targets/balances rather than point-in-time transactions. Building
-- a full multi-currency contribution ledger is deferred to a later phase
-- once exchange-rate infrastructure (Phase C) exists to convert against.

-- ---------------------------------------------------------------------------
-- customers: preferred currency (optional) - auto-selected when creating a
-- new document for that customer, but never required.
-- ---------------------------------------------------------------------------
alter table public.customers
  add column preferred_currency text references public.currencies (code);

-- ---------------------------------------------------------------------------
-- invoices / receipts / quotations / purchase_orders / transactions:
-- currency + rate snapshot, backfilled from the owning business's current
-- currency with rate 1 (the only correct assumption for pre-existing rows,
-- which were always denominated in the business's own currency).
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column currency text references public.currencies (code),
  add column exchange_rate_to_business_currency numeric(20, 10) not null default 1 check (exchange_rate_to_business_currency > 0);

update public.invoices i
set currency = b.currency
from public.businesses b
where b.id = i.business_id and i.currency is null;

alter table public.invoices
  alter column currency set not null;

alter table public.receipts
  add column currency text references public.currencies (code),
  add column exchange_rate_to_business_currency numeric(20, 10) not null default 1 check (exchange_rate_to_business_currency > 0);

update public.receipts r
set currency = b.currency
from public.businesses b
where b.id = r.business_id and r.currency is null;

alter table public.receipts
  alter column currency set not null;

alter table public.quotations
  add column currency text references public.currencies (code),
  add column exchange_rate_to_business_currency numeric(20, 10) not null default 1 check (exchange_rate_to_business_currency > 0);

update public.quotations q
set currency = b.currency
from public.businesses b
where b.id = q.business_id and q.currency is null;

alter table public.quotations
  alter column currency set not null;

alter table public.purchase_orders
  add column currency text references public.currencies (code),
  add column exchange_rate_to_business_currency numeric(20, 10) not null default 1 check (exchange_rate_to_business_currency > 0);

update public.purchase_orders po
set currency = b.currency
from public.businesses b
where b.id = po.business_id and po.currency is null;

alter table public.purchase_orders
  alter column currency set not null;

alter table public.transactions
  add column currency text references public.currencies (code),
  add column exchange_rate_to_business_currency numeric(20, 10) not null default 1 check (exchange_rate_to_business_currency > 0);

update public.transactions t
set currency = b.currency
from public.businesses b
where b.id = t.business_id and t.currency is null;

alter table public.transactions
  alter column currency set not null;

-- ---------------------------------------------------------------------------
-- goals: fixed target currency. business_id is not null here, so the
-- backfill is a straight join.
-- ---------------------------------------------------------------------------
alter table public.goals
  add column currency text references public.currencies (code);

update public.goals g
set currency = b.currency
from public.businesses b
where b.id = g.business_id and g.currency is null;

alter table public.goals
  alter column currency set not null;

-- ---------------------------------------------------------------------------
-- debts: fixed denomination currency. business_id IS nullable here (unlike
-- every other business-scoped table), so orphan debts fall back to GHS -
-- the app's original default currency - since there is no business to
-- inherit a currency from.
-- ---------------------------------------------------------------------------
alter table public.debts
  add column currency text references public.currencies (code);

update public.debts d
set currency = coalesce(
  (select b.currency from public.businesses b where b.id = d.business_id),
  'GHS'
)
where d.currency is null;

alter table public.debts
  alter column currency set not null;
