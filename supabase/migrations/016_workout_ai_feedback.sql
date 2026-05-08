-- ============================================================
-- 016 — AI Coach feedback per workout
-- ============================================================
-- When a workout is saved (manual or from screenshot), the Coach AI
-- generates a short markdown-formatted opinion with full context
-- (up to 30 past workouts). The feedback is persisted so the user
-- sees it again without re-triggering the AI call.
--
-- Columns:
--   ai_feedback              — markdown body of the Coach's opinion
--   ai_feedback_generated_at — when the feedback was produced
-- ============================================================

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT,
  ADD COLUMN IF NOT EXISTS ai_feedback_generated_at TIMESTAMPTZ;

-- Optional: small index to locate workouts missing feedback,
-- in case we want a background backfill later.
CREATE INDEX IF NOT EXISTS idx_workouts_ai_feedback_missing
  ON workouts (user_id, date DESC)
  WHERE ai_feedback IS NULL;
