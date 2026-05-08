-- ============================================================
-- 006 — Reminders, Note Colors, Nested Notebooks
-- ============================================================

-- ── Note Reminders ──────────────────────────────────────────
CREATE TABLE note_reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remind_at   TIMESTAMPTZ NOT NULL,
  dismissed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE note_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders: solo proprietario"
  ON note_reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_reminders_user_time ON note_reminders (user_id, remind_at)
  WHERE NOT dismissed;

-- ── Note Color/Emoji ────────────────────────────────────────
ALTER TABLE notes ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT NULL;

-- ── Nested Notebooks (parent_id) ────────────────────────────
ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES notebooks(id) ON DELETE SET NULL DEFAULT NULL;

CREATE INDEX idx_notebooks_parent ON notebooks (parent_id);

-- ── Sort Preference (per-user) ──────────────────────────────
-- Stored in user metadata via Supabase auth, no table needed.
