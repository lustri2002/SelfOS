-- Shared note links with expiring tokens
CREATE TABLE IF NOT EXISTS shared_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shared_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own shared links"
  ON shared_notes FOR ALL
  USING (auth.uid() = user_id);

-- Public read access via token (no auth needed)
CREATE POLICY "Anyone can read via valid token"
  ON shared_notes FOR SELECT
  USING (expires_at > now());
