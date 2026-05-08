-- Soft delete: add deleted_at to notes
ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Auto-purge notes in trash after 30 days
CREATE OR REPLACE FUNCTION purge_deleted_notes() RETURNS trigger AS $$
BEGIN
  DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_purge_deleted_notes
  AFTER INSERT OR UPDATE ON notes
  FOR EACH STATEMENT
  EXECUTE FUNCTION purge_deleted_notes();

-- Note templates
CREATE TABLE note_templates (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name      TEXT NOT NULL,
  content   JSONB NOT NULL DEFAULT '{}',
  tags      TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE note_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solo proprietario" ON note_templates
  FOR ALL USING (auth.uid() = user_id);

-- Index for faster trash queries
CREATE INDEX idx_notes_deleted_at ON notes (deleted_at) WHERE deleted_at IS NOT NULL;
