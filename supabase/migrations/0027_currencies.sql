-- Reference table for real currency data - replaces the fragile 3-letter
-- shape-only regex (see currencyField in src/server/validation/common.ts)
-- that let any 3-letter string through with no real ISO 4217 backing.
--
-- minor_unit is what makes money math currency-aware: most currencies use 2
-- decimal places, but a handful genuinely don't (JPY/KRW/UGX use 0; BHD/KWD/
-- OMR use 3) - src/lib/money.ts previously hardcoded a flat 100 (2 decimals)
-- for every currency, which would silently miscompute for any of those.
--
-- symbol is a display fallback only - actual locale-correct symbol
-- placement, thousands/decimal separators, and spacing are handled by
-- Intl.NumberFormat at render time (see src/lib/currency.ts), not stored
-- here as separate columns that could drift out of sync with reality.
--
-- This is a reference table, not a structural dependency: adding a
-- currency this seed missed is a single INSERT, never a schema change.
create table public.currencies (
  code text primary key check (char_length(code) = 3 and code = upper(code)),
  name text not null,
  symbol text not null,
  minor_unit integer not null default 2 check (minor_unit between 0 and 4),
  is_active boolean not null default true
);

-- Readable by anyone signed in (it's not sensitive, and every business
-- needs to read the full list to populate a currency picker) - no RLS
-- restriction needed, but RLS is still enabled per this project's rule
-- that every table has it on from creation.
alter table public.currencies enable row level security;
create policy "currencies_select_all" on public.currencies for select using (true);
-- No insert/update/delete policy for regular users - this table is
-- maintained via migrations only.

insert into public.currencies (code, name, symbol, minor_unit) values
  -- Major global currencies
  ('USD', 'US Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('GBP', 'British Pound', '£', 2),
  ('CAD', 'Canadian Dollar', '$', 2),
  ('AUD', 'Australian Dollar', '$', 2),
  ('NZD', 'New Zealand Dollar', '$', 2),
  ('CHF', 'Swiss Franc', 'CHF', 2),
  ('JPY', 'Japanese Yen', '¥', 0),
  ('CNY', 'Chinese Yuan', '¥', 2),
  ('INR', 'Indian Rupee', '₹', 2),
  ('KRW', 'South Korean Won', '₩', 0),
  ('SGD', 'Singapore Dollar', '$', 2),
  ('HKD', 'Hong Kong Dollar', '$', 2),
  ('AED', 'UAE Dirham', 'د.إ', 2),
  ('SAR', 'Saudi Riyal', '﷼', 2),
  ('QAR', 'Qatari Riyal', '﷼', 2),

  -- African currencies (the core audience - kept as comprehensive as possible)
  ('GHS', 'Ghanaian Cedi', '₵', 2),
  ('NGN', 'Nigerian Naira', '₦', 2),
  ('KES', 'Kenyan Shilling', 'KSh', 2),
  ('ZAR', 'South African Rand', 'R', 2),
  ('EGP', 'Egyptian Pound', '£', 2),
  ('MAD', 'Moroccan Dirham', 'د.م.', 2),
  ('TZS', 'Tanzanian Shilling', 'TSh', 2),
  ('UGX', 'Ugandan Shilling', 'USh', 0),
  ('XOF', 'West African CFA Franc', 'CFA', 0),
  ('XAF', 'Central African CFA Franc', 'FCFA', 0),
  ('GNF', 'Guinean Franc', 'FG', 0),
  ('RWF', 'Rwandan Franc', 'FRw', 0),
  ('ETB', 'Ethiopian Birr', 'Br', 2),
  ('ZMW', 'Zambian Kwacha', 'ZK', 2),
  ('MWK', 'Malawian Kwacha', 'MK', 2),
  ('BWP', 'Botswana Pula', 'P', 2),
  ('NAD', 'Namibian Dollar', '$', 2),
  ('MZN', 'Mozambican Metical', 'MT', 2),
  ('AOA', 'Angolan Kwanza', 'Kz', 2),
  ('SDG', 'Sudanese Pound', '£', 2),
  ('DZD', 'Algerian Dinar', 'د.ج', 2),
  ('TND', 'Tunisian Dinar', 'د.ت', 3),
  ('LYD', 'Libyan Dinar', 'ل.د', 3),
  ('SOS', 'Somali Shilling', 'S', 2),
  ('SLL', 'Sierra Leonean Leone', 'Le', 2),
  ('LRD', 'Liberian Dollar', '$', 2),
  ('GMD', 'Gambian Dalasi', 'D', 2),
  ('CVE', 'Cape Verdean Escudo', '$', 2),
  ('MUR', 'Mauritian Rupee', '₨', 2),
  ('SCR', 'Seychellois Rupee', '₨', 2),
  ('MGA', 'Malagasy Ariary', 'Ar', 2),
  ('BIF', 'Burundian Franc', 'FBu', 0),
  ('DJF', 'Djiboutian Franc', 'Fdj', 0),
  ('KMF', 'Comorian Franc', 'CF', 0),
  ('STN', 'São Tomé and Príncipe Dobra', 'Db', 2),
  ('SZL', 'Eswatini Lilangeni', 'L', 2),
  ('LSL', 'Lesotho Loti', 'L', 2),

  -- Middle East / Asia
  ('ILS', 'Israeli New Shekel', '₪', 2),
  ('TRY', 'Turkish Lira', '₺', 2),
  ('PKR', 'Pakistani Rupee', '₨', 2),
  ('BDT', 'Bangladeshi Taka', '৳', 2),
  ('LKR', 'Sri Lankan Rupee', '₨', 2),
  ('NPR', 'Nepalese Rupee', '₨', 2),
  ('THB', 'Thai Baht', '฿', 2),
  ('VND', 'Vietnamese Dong', '₫', 0),
  ('IDR', 'Indonesian Rupiah', 'Rp', 2),
  ('MYR', 'Malaysian Ringgit', 'RM', 2),
  ('PHP', 'Philippine Peso', '₱', 2),
  ('BHD', 'Bahraini Dinar', '.د.ب', 3),
  ('KWD', 'Kuwaiti Dinar', 'د.ك', 3),
  ('OMR', 'Omani Rial', '﷼', 3),
  ('JOD', 'Jordanian Dinar', 'د.ا', 3),
  ('LBP', 'Lebanese Pound', 'ل.ل', 2),
  ('IQD', 'Iraqi Dinar', 'ع.د', 3),

  -- Americas
  ('MXN', 'Mexican Peso', '$', 2),
  ('BRL', 'Brazilian Real', 'R$', 2),
  ('ARS', 'Argentine Peso', '$', 2),
  ('CLP', 'Chilean Peso', '$', 0),
  ('COP', 'Colombian Peso', '$', 2),
  ('PEN', 'Peruvian Sol', 'S/', 2),
  ('UYU', 'Uruguayan Peso', '$U', 2),
  ('BOB', 'Bolivian Boliviano', 'Bs.', 2),
  ('PYG', 'Paraguayan Guarani', '₲', 0),
  ('JMD', 'Jamaican Dollar', '$', 2),
  ('TTD', 'Trinidad and Tobago Dollar', '$', 2),
  ('BBD', 'Barbadian Dollar', '$', 2),
  ('BSD', 'Bahamian Dollar', '$', 2),
  ('DOP', 'Dominican Peso', 'RD$', 2),
  ('HTG', 'Haitian Gourde', 'G', 2),
  ('GTQ', 'Guatemalan Quetzal', 'Q', 2),
  ('HNL', 'Honduran Lempira', 'L', 2),
  ('NIO', 'Nicaraguan Córdoba', 'C$', 2),
  ('CRC', 'Costa Rican Colón', '₡', 2),
  ('PAB', 'Panamanian Balboa', 'B/.', 2),

  -- Europe (non-Euro)
  ('SEK', 'Swedish Krona', 'kr', 2),
  ('NOK', 'Norwegian Krone', 'kr', 2),
  ('DKK', 'Danish Krone', 'kr', 2),
  ('PLN', 'Polish Zloty', 'zł', 2),
  ('CZK', 'Czech Koruna', 'Kč', 2),
  ('HUF', 'Hungarian Forint', 'Ft', 2),
  ('RON', 'Romanian Leu', 'lei', 2),
  ('BGN', 'Bulgarian Lev', 'лв', 2),
  ('ISK', 'Icelandic Krona', 'kr', 0),
  ('RUB', 'Russian Ruble', '₽', 2),
  ('UAH', 'Ukrainian Hryvnia', '₴', 2),

  -- Oceania / other
  ('FJD', 'Fijian Dollar', '$', 2),
  ('PGK', 'Papua New Guinean Kina', 'K', 2),
  ('WST', 'Samoan Tala', 'T', 2),
  ('TOP', 'Tongan Paʻanga', 'T$', 2),
  ('VUV', 'Vanuatu Vatu', 'VT', 0),
  ('XPF', 'CFP Franc', '₣', 0)
on conflict (code) do nothing;
