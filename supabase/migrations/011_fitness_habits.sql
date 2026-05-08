-- ============================================================
-- 011 — Fitness & Habits module
-- ============================================================

-- General habits
CREATE TABLE IF NOT EXISTS habits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT,
  color       TEXT DEFAULT 'indigo',
  is_active   BOOLEAN DEFAULT true,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own habits" ON habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own habits" ON habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own habits" ON habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own habits" ON habits FOR DELETE USING (auth.uid() = user_id);

-- Daily habit completions
CREATE TABLE IF NOT EXISTS habit_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id    UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,           -- "2026-04-15" format
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(habit_id, date)
);

ALTER TABLE habit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own entries" ON habit_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own entries" ON habit_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own entries" ON habit_entries FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_habit_entries_user_date ON habit_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_entries_habit ON habit_entries(habit_id, date);

-- Workouts (running focus)
CREATE TABLE IF NOT EXISTS workouts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date                        TEXT NOT NULL,           -- "2026-04-15"
  type                        TEXT NOT NULL DEFAULT 'easy_run',
  distance_km                 NUMERIC(6,2),
  duration_minutes            NUMERIC(6,1),
  avg_pace                    TEXT,                    -- "10'07"
  best_pace                   TEXT,
  calories                    INT,
  avg_heart_rate              INT,
  max_heart_rate              INT,
  avg_cadence                 INT,
  elevation_m                 INT,
  steps                       INT,
  feeling                     INT CHECK (feeling BETWEEN 1 AND 5),
  notes                       TEXT,
  intervals                   JSONB,
  training_effect_aerobic     NUMERIC(3,1),
  training_effect_anaerobic   NUMERIC(3,1),
  source                      TEXT DEFAULT 'manual',   -- 'manual' | 'screenshot'
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own workouts" ON workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own workouts" ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own workouts" ON workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own workouts" ON workouts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date);
