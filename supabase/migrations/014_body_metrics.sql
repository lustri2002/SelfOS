-- ============================================================
-- 014 — Body metrics tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS body_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  weight_kg     NUMERIC(5,1),
  body_fat_pct  NUMERIC(4,1),
  waist_cm      NUMERIC(5,1),
  resting_hr    INT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own metrics" ON body_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own metrics" ON body_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own metrics" ON body_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own metrics" ON body_metrics FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_body_metrics_user_date ON body_metrics(user_id, date DESC);
