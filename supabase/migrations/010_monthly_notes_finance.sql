-- ============================================================
-- 010 — Monthly notes for finance module
-- ============================================================

CREATE TABLE IF NOT EXISTS monthly_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,           -- "2026-04" format
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE monthly_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own monthly notes"
  ON monthly_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own monthly notes"
  ON monthly_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own monthly notes"
  ON monthly_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own monthly notes"
  ON monthly_notes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_monthly_notes_user_month ON monthly_notes(user_id, month);
