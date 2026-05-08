-- ============================================================
-- University record invariants
-- ============================================================

ALTER TABLE university_exams
  DROP CONSTRAINT IF EXISTS university_exams_completed_require_grade_date;

UPDATE university_exams
SET status = 'planned'
WHERE status <> 'planned'
  AND (grade IS NULL OR exam_date IS NULL);

ALTER TABLE university_exams
  ADD CONSTRAINT university_exams_completed_require_grade_date
  CHECK (
    status = 'planned'
    OR (status = 'booked' AND exam_date IS NOT NULL)
    OR (status IN ('online', 'recognized') AND grade IS NOT NULL AND exam_date IS NOT NULL)
  );
