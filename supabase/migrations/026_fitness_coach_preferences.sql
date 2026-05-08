-- ============================================================
-- 026 — Persistent Fitness Coach preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS fitness_coach_preferences (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  goal        TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fitness_coach_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own coach preferences"
  ON fitness_coach_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own coach preferences"
  ON fitness_coach_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own coach preferences"
  ON fitness_coach_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
