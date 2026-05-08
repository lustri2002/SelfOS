-- ============================================================
-- 009 — Monthly income entries (replacing daily transactions)
-- ============================================================

-- Monthly income entries (stipendio, freelance, etc.)
CREATE TABLE IF NOT EXISTS monthly_income (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,           -- "2026-04" format
  label       TEXT NOT NULL DEFAULT 'Stipendio',
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE monthly_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own income"
  ON monthly_income FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own income"
  ON monthly_income FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own income"
  ON monthly_income FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own income"
  ON monthly_income FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_monthly_income_user_month ON monthly_income(user_id, month);

-- Add savings goal fields + installment tracking to financial_commitments
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS goal_type TEXT CHECK (goal_type IN ('debt', 'savings')) DEFAULT 'debt';
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC(12,2) DEFAULT NULL;
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS current_saved NUMERIC(12,2) DEFAULT 0;
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS total_installments INT DEFAULT NULL;
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS paid_installments INT DEFAULT 0;
ALTER TABLE financial_commitments
  ADD COLUMN IF NOT EXISTS due_day INT DEFAULT NULL; -- day of month (1-31)
