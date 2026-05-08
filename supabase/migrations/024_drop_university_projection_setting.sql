-- ============================================================
-- Remove unused university projection setting
-- ============================================================

ALTER TABLE university_settings
  DROP COLUMN IF EXISTS target_missing_avg;
