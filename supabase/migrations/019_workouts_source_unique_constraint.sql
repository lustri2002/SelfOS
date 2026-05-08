-- ============================================================
-- 019 — Fix unique constraint per ON CONFLICT dei sync Strava
-- ============================================================
-- La 018 creava un partial unique index (WHERE source_id IS NOT NULL).
-- Postgres non lo accetta come arbitro di ON CONFLICT tramite la sintassi
-- a colonne (che e' quella usata da supabase-js: .upsert({...}, { onConflict: "..." })).
--
-- Sostituiamo con un index NON partial. NULL handling di Postgres:
-- due righe con lo stesso (user_id, source) ma source_id=NULL sono
-- considerate distinte → gli workout manuali/screenshot continuano a
-- coesistere senza problemi.
-- ============================================================

-- Rimuovi il partial index della 018.
DROP INDEX IF EXISTS idx_workouts_user_source_sourceid;

-- Ricrea come unique index completo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workouts_user_source_sourceid
  ON workouts(user_id, source, source_id);

COMMENT ON INDEX idx_workouts_user_source_sourceid IS
  'Unique per de-dup degli import esterni. I NULL in source_id non collidono tra loro (default Postgres), quindi i workout manuali/screenshot restano liberi di ripetersi.';
