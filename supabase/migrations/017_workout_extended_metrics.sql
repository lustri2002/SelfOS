-- ============================================================
-- 017 — Estensione metriche allenamento
-- ============================================================
-- Gli screenshot di Mi Fitness / Zepp Life contengono molti piu'
-- dati di quanti ne estraessimo finora. Aggiungiamo colonne per:
--   - Zone di frequenza cardiaca (tempo in ciascuna zona)
--   - Cadenza massima (gia' abbiamo avg_cadence)
--   - Falcata media / massima (stride length)
--   - VO2 max stimato
--   - Ore di recupero consigliate dal device
--
-- Tutte le colonne sono nullable: allenamenti storici rimangono validi.
--
-- hr_zones schema (JSONB):
--   {
--     "leggera":    seconds,
--     "intensiva":  seconds,
--     "aerobica":   seconds,
--     "anaerobica": seconds,
--     "vo2max":     seconds
--   }
-- ============================================================

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS hr_zones       JSONB,
  ADD COLUMN IF NOT EXISTS max_cadence    INTEGER,
  ADD COLUMN IF NOT EXISTS avg_stride_cm  INTEGER,
  ADD COLUMN IF NOT EXISTS max_stride_cm  INTEGER,
  ADD COLUMN IF NOT EXISTS vo2_max        NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS recovery_hours INTEGER;

COMMENT ON COLUMN workouts.hr_zones       IS 'Tempo in ciascuna zona FC in secondi: {leggera, intensiva, aerobica, anaerobica, vo2max}';
COMMENT ON COLUMN workouts.max_cadence    IS 'Cadenza massima in passi/minuto';
COMMENT ON COLUMN workouts.avg_stride_cm  IS 'Lunghezza media falcata in centimetri';
COMMENT ON COLUMN workouts.max_stride_cm  IS 'Lunghezza massima falcata in centimetri';
COMMENT ON COLUMN workouts.vo2_max        IS 'VO2 max stimato (ml/kg/min)';
COMMENT ON COLUMN workouts.recovery_hours IS 'Ore di recupero consigliate dal device';
