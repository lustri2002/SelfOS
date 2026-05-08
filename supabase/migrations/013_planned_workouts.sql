-- ============================================================
-- 013 — Planned workouts (linked to training plans)
-- ============================================================

CREATE TABLE IF NOT EXISTS planned_workouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_label         TEXT NOT NULL,              -- "Lunedì", "Mercoledì", etc.
  workout_type      TEXT NOT NULL DEFAULT 'easy_run',
  title             TEXT NOT NULL,              -- "Corsa Facile + Mobilità"
  description       TEXT,                       -- detailed instructions
  distance_km       NUMERIC(6,2),
  duration_minutes  NUMERIC(6,1),
  pace_target       TEXT,                       -- "11'00\"/km"
  actual_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE planned_workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own planned_workouts" ON planned_workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own planned_workouts" ON planned_workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own planned_workouts" ON planned_workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own planned_workouts" ON planned_workouts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_planned_workouts_plan ON planned_workouts(plan_id, sort_order);
