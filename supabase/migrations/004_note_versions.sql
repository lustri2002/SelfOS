-- Note version history (snapshots)
CREATE TABLE IF NOT EXISTS note_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own versions"
  ON note_versions FOR ALL
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_note_versions_note_id ON note_versions(note_id, created_at DESC);

-- Keep max 20 versions per note (cleanup function)
CREATE OR REPLACE FUNCTION cleanup_old_versions() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM note_versions
  WHERE id IN (
    SELECT id FROM note_versions
    WHERE note_id = NEW.note_id
    ORDER BY created_at DESC
    OFFSET 20
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_versions
  AFTER INSERT ON note_versions
  FOR EACH ROW EXECUTE FUNCTION cleanup_old_versions();
