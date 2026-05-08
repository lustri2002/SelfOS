-- ============================================================
-- 018 — Integrazione Strava
-- ============================================================
-- Archiviamo i token OAuth di Strava (cifrati lato server con
-- AES-256-GCM: nel DB vediamo solo ciphertext base64) e aggiungiamo
-- a `workouts` i campi necessari per il de-duplication quando
-- sincronizziamo le attivita' da Strava.
--
-- Sicurezza:
--   - Tokens cifrati at rest (la chiave vive solo in env, mai in DB).
--   - RLS stretta: l'utente puo' leggere/scrivere solo la propria riga.
--   - Nessuna service-role bypass: tutti gli endpoint passano da
--     createClient() con JWT dell'utente.
-- ============================================================

-- 1) Tabella connessioni Strava (1 connessione per user)
CREATE TABLE IF NOT EXISTS strava_connections (
  user_id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id           BIGINT      NOT NULL,
  athlete_firstname    TEXT,
  athlete_lastname     TEXT,
  access_token_enc     TEXT        NOT NULL,
  refresh_token_enc    TEXT        NOT NULL,
  expires_at           TIMESTAMPTZ NOT NULL,
  scope                TEXT,
  last_sync_at         TIMESTAMPTZ,
  last_sync_count      INTEGER     DEFAULT 0,
  last_sync_error      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  strava_connections                   IS 'Token OAuth Strava per utente (ciphertext AES-256-GCM)';
COMMENT ON COLUMN strava_connections.access_token_enc  IS 'Token di accesso cifrato: base64(iv || ciphertext || authTag)';
COMMENT ON COLUMN strava_connections.refresh_token_enc IS 'Refresh token cifrato: base64(iv || ciphertext || authTag)';
COMMENT ON COLUMN strava_connections.expires_at        IS 'Scadenza access token (di solito 6 ore dall''ultimo refresh)';

-- 2) RLS
ALTER TABLE strava_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS strava_connections_select_own ON strava_connections;
CREATE POLICY strava_connections_select_own ON strava_connections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS strava_connections_insert_own ON strava_connections;
CREATE POLICY strava_connections_insert_own ON strava_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS strava_connections_update_own ON strava_connections;
CREATE POLICY strava_connections_update_own ON strava_connections
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS strava_connections_delete_own ON strava_connections;
CREATE POLICY strava_connections_delete_own ON strava_connections
  FOR DELETE USING (auth.uid() = user_id);

-- 3) Trigger per updated_at
CREATE OR REPLACE FUNCTION strava_connections_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_strava_connections_updated_at ON strava_connections;
CREATE TRIGGER trg_strava_connections_updated_at
  BEFORE UPDATE ON strava_connections
  FOR EACH ROW EXECUTE FUNCTION strava_connections_touch_updated_at();

-- 4) Campi su workouts per il de-dup degli import esterni
ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS source_id   TEXT,
  ADD COLUMN IF NOT EXISTS source_url  TEXT;

COMMENT ON COLUMN workouts.source_id  IS 'ID dell''attivita' presso la fonte esterna (es. Strava activity id)';
COMMENT ON COLUMN workouts.source_url IS 'URL canonico dell''attivita' esterna (es. https://www.strava.com/activities/12345)';

-- Unique index: niente duplicati quando risincronizziamo.
-- Solo sulle righe con source_id non-null (gli allenamenti manuali/screenshot non hanno source_id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_user_source_sourceid
  ON workouts(user_id, source, source_id)
  WHERE source_id IS NOT NULL;
