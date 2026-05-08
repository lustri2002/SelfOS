-- Distinguish cash receipt month from the month funded by that income.

alter table monthly_income
  add column if not exists budget_month text;

update monthly_income
set budget_month = month
where budget_month is null;

alter table monthly_income
  alter column budget_month set default to_char(now(), 'YYYY-MM');

create index if not exists idx_monthly_income_user_budget_month
  on monthly_income(user_id, budget_month);
