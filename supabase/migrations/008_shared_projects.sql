-- ============================================================
-- 008 — Shared Projects (notes + tasks use same projects)
-- ============================================================

-- Add project_id to notes (reuse projects table from tasks)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_project ON notes (project_id) WHERE deleted_at IS NULL;
