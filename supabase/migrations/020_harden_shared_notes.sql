-- Harden public note sharing.
--
-- Public visitors never read `shared_notes` directly anymore. The Next.js
-- server resolves /share/:token with the service-role key, validates expiry,
-- and then fetches exactly the note owned by the share creator.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS shared_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own shared links" ON shared_notes;
DROP POLICY IF EXISTS "Anyone can read via valid token" ON shared_notes;
DROP POLICY IF EXISTS "shared_notes: owner select" ON shared_notes;
DROP POLICY IF EXISTS "shared_notes: owner insert own note" ON shared_notes;
DROP POLICY IF EXISTS "shared_notes: owner update own note" ON shared_notes;
DROP POLICY IF EXISTS "shared_notes: owner delete" ON shared_notes;

CREATE POLICY "shared_notes: owner select"
  ON shared_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "shared_notes: owner insert own note"
  ON shared_notes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = shared_notes.note_id
        AND notes.user_id = auth.uid()
        AND notes.deleted_at IS NULL
    )
  );

CREATE POLICY "shared_notes: owner update own note"
  ON shared_notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = shared_notes.note_id
        AND notes.user_id = auth.uid()
        AND notes.deleted_at IS NULL
    )
  );

CREATE POLICY "shared_notes: owner delete"
  ON shared_notes FOR DELETE
  USING (auth.uid() = user_id);
