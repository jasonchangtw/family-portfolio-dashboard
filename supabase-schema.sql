-- Family Portfolio Dashboard MVP schema draft
-- Target: Supabase PostgreSQL

create extension if not exists "pgcrypto";

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_currency text not null default 'TWD',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create type household_role as enum ('admin');

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role household_role not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create type account_kind as enum ('brokerage', 'cash');
create type market_code as enum ('TW', 'US');
create type security_kind as enum ('stock', 'etf', 'cash', 'other');
create type position_status as enum ('active', 'closed', 'archived', 'deleted');
create type transaction_kind as enum ('buy', 'sell');
create type value_status as enum ('estimated', 'actual', 'missing', 'outdated');
create type dividend_kind as enum ('cash', 'reinvested');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  kind account_kind not null,
  broker text,
  currency text not null default 'TWD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table securities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  ticker text not null,
  name text not null,
  market market_code not null,
  currency text not null,
  kind security_kind not null default 'stock',
  status position_status not null default 'active',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, market, ticker)
);

create table fee_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid references accounts(id) on delete cascade,
  market market_code not null,
  name text not null,
  commission_rate numeric(18, 8) not null default 0,
  commission_discount numeric(18, 8) not null default 1,
  minimum_commission numeric(18, 4) not null default 0,
  sell_tax_rate numeric(18, 8) not null default 0,
  currency text not null default 'TWD',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid not null references accounts(id),
  security_id uuid not null references securities(id),
  trade_date date not null,
  kind transaction_kind not null,
  quantity numeric(24, 8) not null check (quantity > 0),
  price numeric(24, 8) not null check (price >= 0),
  trade_currency text not null,
  commission numeric(24, 8) not null default 0,
  tax numeric(24, 8) not null default 0,
  regulatory_fee numeric(24, 8) not null default 0,
  exchange_fee numeric(24, 8) not null default 0,
  other_fee numeric(24, 8) not null default 0,
  fee_currency text not null default 'TWD',
  fx_rate_to_twd numeric(24, 8) not null default 1,
  actual_twd_amount numeric(24, 4),
  value_status value_status not null default 'estimated',
  decision_reason text,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table dividends (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  account_id uuid not null references accounts(id),
  security_id uuid not null references securities(id),
  payment_date date not null,
  ex_dividend_date date,
  kind dividend_kind not null default 'cash',
  amount_per_share numeric(24, 8),
  gross_amount numeric(24, 8) not null default 0,
  withholding_tax numeric(24, 8) not null default 0,
  supplemental_premium numeric(24, 8) not null default 0,
  other_deductions numeric(24, 8) not null default 0,
  net_amount numeric(24, 8) not null default 0,
  currency text not null,
  fx_rate_to_twd numeric(24, 8) not null default 1,
  reinvested_quantity numeric(24, 8),
  reinvestment_price numeric(24, 8),
  value_status value_status not null default 'estimated',
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table fx_rates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  rate_date date not null,
  from_currency text not null,
  to_currency text not null default 'TWD',
  rate numeric(24, 8) not null,
  source text not null default 'Fubon Bank',
  value_status value_status not null default 'estimated',
  created_at timestamptz not null default now(),
  unique (household_id, rate_date, from_currency, to_currency, source)
);

create table price_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  security_id uuid not null references securities(id) on delete cascade,
  price_date date not null,
  close_price numeric(24, 8) not null,
  currency text not null,
  source text,
  value_status value_status not null default 'estimated',
  created_at timestamptz not null default now(),
  unique (household_id, security_id, price_date, source)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  actor_id uuid references profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table exports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  requested_by uuid references profiles(id),
  export_kind text not null,
  file_name text,
  created_at timestamptz not null default now()
);

alter table households enable row level security;
alter table profiles enable row level security;
alter table household_members enable row level security;
alter table accounts enable row level security;
alter table securities enable row level security;
alter table fee_rules enable row level security;
alter table transactions enable row level security;
alter table dividends enable row level security;
alter table fx_rates enable row level security;
alter table price_snapshots enable row level security;
alter table audit_logs enable row level security;
alter table exports enable row level security;

create or replace function is_household_admin(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

create policy "household admins can read accounts"
on accounts for select
using (is_household_admin(household_id));

create policy "household admins can write accounts"
on accounts for all
using (is_household_admin(household_id))
with check (is_household_admin(household_id));

create policy "household admins can read securities"
on securities for select
using (is_household_admin(household_id));

create policy "household admins can write securities"
on securities for all
using (is_household_admin(household_id))
with check (is_household_admin(household_id));

create policy "household admins can read transactions"
on transactions for select
using (is_household_admin(household_id));

create policy "household admins can write transactions"
on transactions for all
using (is_household_admin(household_id))
with check (is_household_admin(household_id));

create policy "household admins can read dividends"
on dividends for select
using (is_household_admin(household_id));

create policy "household admins can write dividends"
on dividends for all
using (is_household_admin(household_id))
with check (is_household_admin(household_id));

create policy "household admins can read supporting data"
on fx_rates for select
using (is_household_admin(household_id));

create policy "household admins can write supporting data"
on fx_rates for all
using (is_household_admin(household_id))
with check (is_household_admin(household_id));

create policy "household admins can read prices"
on price_snapshots for select
using (is_household_admin(household_id));

create policy "household admins can write prices"
on price_snapshots for all
using (is_household_admin(household_id))
with check (is_household_admin(household_id));

create policy "household admins can read fee rules"
on fee_rules for select
using (is_household_admin(household_id));

create policy "household admins can write fee rules"
on fee_rules for all
using (is_household_admin(household_id))
with check (is_household_admin(household_id));

create policy "household admins can read audit logs"
on audit_logs for select
using (is_household_admin(household_id));

create policy "household admins can read exports"
on exports for select
using (is_household_admin(household_id));

create policy "household admins can write exports"
on exports for all
using (is_household_admin(household_id))
with check (is_household_admin(household_id));

create policy "users can read their own profile"
on profiles for select
using (id = auth.uid());

create policy "users can update their own profile"
on profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "household admins can read memberships"
on household_members for select
using (is_household_admin(household_id));

create policy "household admins can read households"
on households for select
using (is_household_admin(id));
