-- ============================================================
-- University booked status
-- ============================================================

ALTER TABLE university_exams
  DROP CONSTRAINT IF EXISTS university_exams_completed_require_grade_date;

ALTER TABLE university_exams
  DROP CONSTRAINT IF EXISTS university_exams_status_check;

UPDATE university_exams
SET status = CASE
  WHEN status = 'passed' AND grade IS NOT NULL AND exam_date IS NOT NULL THEN 'recognized'
  WHEN status <> 'planned' AND grade IS NULL AND exam_date IS NOT NULL THEN 'booked'
  WHEN status <> 'planned' AND (grade IS NULL OR exam_date IS NULL) THEN 'planned'
  ELSE status
END;

ALTER TABLE university_exams
  ADD CONSTRAINT university_exams_status_check
  CHECK (status IN ('planned', 'booked', 'online', 'recognized'));

ALTER TABLE university_exams
  ADD CONSTRAINT university_exams_completed_require_grade_date
  CHECK (
    status = 'planned'
    OR (status = 'booked' AND exam_date IS NOT NULL)
    OR (status IN ('online', 'recognized') AND grade IS NOT NULL AND exam_date IS NOT NULL)
  );
