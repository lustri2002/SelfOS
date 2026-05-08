-- ============================================================
-- University record
-- ============================================================

CREATE TABLE university_settings (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name        TEXT,
  student_number      TEXT,
  degree_course       TEXT,
  total_cfu           INTEGER NOT NULL DEFAULT 180 CHECK (total_cfu > 0),
  bonus_points        NUMERIC(4, 1) NOT NULL DEFAULT 4 CHECK (bonus_points >= 0),
  honors_value        NUMERIC(4, 1) NOT NULL DEFAULT 31 CHECK (honors_value BETWEEN 30 AND 33),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE university_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "university_settings: solo proprietario"
  ON university_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE university_exams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  cfu         INTEGER NOT NULL CHECK (cfu > 0),
  grade       INTEGER CHECK (grade BETWEEN 18 AND 30),
  honors      BOOLEAN NOT NULL DEFAULT false,
  status      TEXT NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned', 'booked', 'online', 'recognized')),
  exam_type   TEXT NOT NULL DEFAULT 'mandatory'
              CHECK (exam_type IN ('mandatory', 'elective')),
  year        INTEGER NOT NULL DEFAULT 1 CHECK (year BETWEEN 1 AND 6),
  area        TEXT,
  exam_date   DATE,
  counts_avg  BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT university_exams_completed_require_grade_date
              CHECK (
                status = 'planned'
                OR (status = 'booked' AND exam_date IS NOT NULL)
                OR (status IN ('online', 'recognized') AND grade IS NOT NULL AND exam_date IS NOT NULL)
              )
);

ALTER TABLE university_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "university_exams: solo proprietario"
  ON university_exams FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX university_exams_user_year_idx ON university_exams (user_id, year, sort_order, name);
CREATE INDEX university_exams_user_status_idx ON university_exams (user_id, status);

CREATE TRIGGER trg_university_settings_updated_at
  BEFORE UPDATE ON university_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_university_exams_updated_at
  BEFORE UPDATE ON university_exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
