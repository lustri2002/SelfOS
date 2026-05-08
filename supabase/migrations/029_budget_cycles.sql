-- Monthly envelope planning: plan vs reality without tracking every expense.

create table if not exists budget_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  planned_savings numeric(12,2) not null default 0,
  planned_variable_spending numeric(12,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month)
);

alter table budget_cycles enable row level security;

drop policy if exists budget_cycles_select_own on budget_cycles;
create policy budget_cycles_select_own on budget_cycles
  for select using (auth.uid() = user_id);

drop policy if exists budget_cycles_insert_own on budget_cycles;
create policy budget_cycles_insert_own on budget_cycles
  for insert with check (auth.uid() = user_id);

drop policy if exists budget_cycles_update_own on budget_cycles;
create policy budget_cycles_update_own on budget_cycles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists budget_cycles_delete_own on budget_cycles;
create policy budget_cycles_delete_own on budget_cycles
  for delete using (auth.uid() = user_id);

create index if not exists budget_cycles_user_month_idx
  on budget_cycles(user_id, month);
