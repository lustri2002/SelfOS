-- ============================================================
-- 015 — Add height_cm to body_metrics for BMI calculation
-- ============================================================

ALTER TABLE body_metrics ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1);
