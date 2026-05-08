-- ============================================================
-- 007 — Task Manager
-- ============================================================

-- ── Projects ────────────────────────────────────────────────
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT 'indigo',
  emoji       TEXT DEFAULT NULL,
  archived    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: solo proprietario"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Tasks ───────────────────────────────────────────────────
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  note_id       UUID REFERENCES notes(id) ON DELETE SET NULL,
  title         TEXT NOT NULL DEFAULT '',
  description   TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'todo'
                  CHECK (status IN ('todo', 'in_progress', 'done')),
  priority      TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  due_date      TIMESTAMPTZ DEFAULT NULL,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  recurring     TEXT DEFAULT NULL
                  CHECK (recurring IS NULL OR recurring IN ('daily', 'weekly', 'monthly')),
  completed_at  TIMESTAMPTZ DEFAULT NULL,
  deleted_at    TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks: solo proprietario"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_tasks_user_status ON tasks (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date ON tasks (user_id, due_date) WHERE deleted_at IS NULL AND status != 'done';
CREATE INDEX idx_tasks_project ON tasks (project_id) WHERE deleted_at IS NULL;

-- ── Subtasks ────────────────────────────────────────────────
CREATE TABLE subtasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT '',
  completed   BOOLEAN NOT NULL DEFAULT false,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;

-- Subtask access is controlled via task ownership
CREATE POLICY "subtasks: accesso tramite task"
  ON subtasks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = subtasks.task_id AND tasks.user_id = auth.uid())
  );

CREATE INDEX idx_subtasks_task ON subtasks (task_id, sort_order);

-- ── Auto-archive completed tasks after 7 days ───────────────
CREATE OR REPLACE FUNCTION auto_archive_completed_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Soft delete tasks completed more than 7 days ago
  UPDATE tasks
  SET deleted_at = now()
  WHERE completed_at IS NOT NULL
    AND completed_at < now() - INTERVAL '7 days'
    AND deleted_at IS NULL;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Run cleanup on any task update
CREATE OR REPLACE TRIGGER trg_auto_archive_tasks
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH STATEMENT
  EXECUTE FUNCTION auto_archive_completed_tasks();

-- ── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
