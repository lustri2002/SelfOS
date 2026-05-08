-- ============================================================
-- 012 — Training plans (AI coach generated)
-- ============================================================

CREATE TABLE IF NOT EXISTS training_plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal        TEXT,
  notes       TEXT,
  plan        TEXT NOT NULL,
  week_start  TEXT NOT NULL,     -- "2026-04-20" (lunedì della settimana)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own plans" ON training_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own plans" ON training_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own plans" ON training_plans FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_training_plans_user ON training_plans(user_id, created_at DESC);
