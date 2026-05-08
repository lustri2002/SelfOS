-- Personal OS modules: goals and automation rules

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  area text not null default 'growth',
  horizon text not null default 'quarter',
  status text not null default 'active',
  target_value numeric,
  current_value numeric not null default 0,
  unit text,
  due_date date,
  linked_project_id uuid references projects(id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goals_horizon_check check (horizon in ('month', 'quarter', 'year', 'life')),
  constraint goals_status_check check (status in ('active', 'paused', 'completed', 'archived'))
);

create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  trigger_type text not null default 'daily_briefing',
  condition_config jsonb not null default '{}'::jsonb,
  action_type text not null default 'surface_in_command_center',
  action_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  run_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_status_idx on goals(user_id, status);
create index if not exists goals_user_due_date_idx on goals(user_id, due_date);
create index if not exists automation_rules_user_active_idx on automation_rules(user_id, is_active);

alter table goals enable row level security;
alter table automation_rules enable row level security;

drop policy if exists goals_select_own on goals;
create policy goals_select_own on goals
  for select using (auth.uid() = user_id);

drop policy if exists goals_insert_own on goals;
create policy goals_insert_own on goals
  for insert with check (auth.uid() = user_id);

drop policy if exists goals_update_own on goals;
create policy goals_update_own on goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists goals_delete_own on goals;
create policy goals_delete_own on goals
  for delete using (auth.uid() = user_id);

drop policy if exists automation_rules_select_own on automation_rules;
create policy automation_rules_select_own on automation_rules
  for select using (auth.uid() = user_id);

drop policy if exists automation_rules_insert_own on automation_rules;
create policy automation_rules_insert_own on automation_rules
  for insert with check (auth.uid() = user_id);

drop policy if exists automation_rules_update_own on automation_rules;
create policy automation_rules_update_own on automation_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists automation_rules_delete_own on automation_rules;
create policy automation_rules_delete_own on automation_rules
  for delete using (auth.uid() = user_id);
