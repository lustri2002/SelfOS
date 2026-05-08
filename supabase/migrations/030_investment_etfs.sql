-- ETF portfolio tracking with price history and recurring PAC plans.

create table if not exists investment_instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  exchange text,
  isin text,
  name text not null,
  currency text not null default 'EUR',
  provider text not null default 'twelvedata',
  provider_symbol text not null,
  last_price numeric(18,6),
  last_price_at timestamptz,
  last_price_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, provider_symbol)
);

alter table investment_instruments enable row level security;

drop policy if exists investment_instruments_select_own on investment_instruments;
create policy investment_instruments_select_own on investment_instruments
  for select using (auth.uid() = user_id);

drop policy if exists investment_instruments_insert_own on investment_instruments;
create policy investment_instruments_insert_own on investment_instruments
  for insert with check (auth.uid() = user_id);

drop policy if exists investment_instruments_update_own on investment_instruments;
create policy investment_instruments_update_own on investment_instruments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists investment_instruments_delete_own on investment_instruments;
create policy investment_instruments_delete_own on investment_instruments
  for delete using (auth.uid() = user_id);

create index if not exists investment_instruments_user_idx
  on investment_instruments(user_id);

create table if not exists investment_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references investment_instruments(id) on delete cascade,
  price numeric(18,6) not null,
  currency text not null default 'EUR',
  priced_at timestamptz not null,
  source text not null default 'twelvedata',
  created_at timestamptz not null default now(),
  unique(instrument_id, source, priced_at)
);

alter table investment_prices enable row level security;

drop policy if exists investment_prices_select_own on investment_prices;
create policy investment_prices_select_own on investment_prices
  for select using (auth.uid() = user_id);

drop policy if exists investment_prices_insert_own on investment_prices;
create policy investment_prices_insert_own on investment_prices
  for insert with check (auth.uid() = user_id);

drop policy if exists investment_prices_update_own on investment_prices;
create policy investment_prices_update_own on investment_prices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists investment_prices_delete_own on investment_prices;
create policy investment_prices_delete_own on investment_prices
  for delete using (auth.uid() = user_id);

create index if not exists investment_prices_instrument_priced_at_idx
  on investment_prices(instrument_id, priced_at desc);

create table if not exists investment_recurring_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  instrument_id uuid not null references investment_instruments(id) on delete cascade,
  name text not null,
  day_of_month integer not null check(day_of_month between 1 and 31),
  amount numeric(12,2) not null check(amount > 0),
  currency text not null default 'EUR',
  is_active boolean not null default true,
  start_month char(7) not null,
  last_executed_month char(7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table investment_recurring_plans enable row level security;

drop policy if exists investment_recurring_plans_select_own on investment_recurring_plans;
create policy investment_recurring_plans_select_own on investment_recurring_plans
  for select using (auth.uid() = user_id);

drop policy if exists investment_recurring_plans_insert_own on investment_recurring_plans;
create policy investment_recurring_plans_insert_own on investment_recurring_plans
  for insert with check (auth.uid() = user_id);

drop policy if exists investment_recurring_plans_update_own on investment_recurring_plans;
create policy investment_recurring_plans_update_own on investment_recurring_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists investment_recurring_plans_delete_own on investment_recurring_plans;
create policy investment_recurring_plans_delete_own on investment_recurring_plans
  for delete using (auth.uid() = user_id);

create index if not exists investment_recurring_plans_user_active_idx
  on investment_recurring_plans(user_id, is_active);

create table if not exists investment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  instrument_id uuid not null references investment_instruments(id) on delete cascade,
  recurring_plan_id uuid references investment_recurring_plans(id) on delete set null,
  type text not null check(type in ('buy', 'sell')),
  trade_date date not null,
  shares numeric(20,8) not null check(shares > 0),
  price numeric(18,6) not null check(price > 0),
  fees numeric(12,2) not null default 0,
  currency text not null default 'EUR',
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table investment_transactions enable row level security;

drop policy if exists investment_transactions_select_own on investment_transactions;
create policy investment_transactions_select_own on investment_transactions
  for select using (auth.uid() = user_id);

drop policy if exists investment_transactions_insert_own on investment_transactions;
create policy investment_transactions_insert_own on investment_transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists investment_transactions_update_own on investment_transactions;
create policy investment_transactions_update_own on investment_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists investment_transactions_delete_own on investment_transactions;
create policy investment_transactions_delete_own on investment_transactions
  for delete using (auth.uid() = user_id);

create index if not exists investment_transactions_user_date_idx
  on investment_transactions(user_id, trade_date desc);

create unique index if not exists investment_transactions_pac_month_idx
  on investment_transactions(user_id, recurring_plan_id, date_trunc('month', trade_date::timestamp))
  where recurring_plan_id is not null;

drop trigger if exists trg_investment_instruments_updated_at on investment_instruments;
create trigger trg_investment_instruments_updated_at
  before update on investment_instruments
  for each row execute function update_updated_at();

drop trigger if exists trg_investment_recurring_plans_updated_at on investment_recurring_plans;
create trigger trg_investment_recurring_plans_updated_at
  before update on investment_recurring_plans
  for each row execute function update_updated_at();
