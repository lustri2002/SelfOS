-- ============================================================
-- University exam type
-- ============================================================

ALTER TABLE university_exams
  ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'mandatory';

ALTER TABLE university_exams
  DROP CONSTRAINT IF EXISTS university_exams_exam_type_check;

ALTER TABLE university_exams
  ADD CONSTRAINT university_exams_exam_type_check
  CHECK (exam_type IN ('mandatory', 'elective'));
