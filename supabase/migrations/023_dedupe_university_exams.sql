-- ============================================================
-- Remove duplicate university exams produced by early auto-seed
-- ============================================================

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, lower(trim(name)), cfu, year
      ORDER BY
        CASE WHEN status <> 'planned' THEN 0 ELSE 1 END,
        created_at,
        id
    ) AS rn
  FROM university_exams
)
DELETE FROM university_exams
USING ranked
WHERE university_exams.id = ranked.id
  AND ranked.rn > 1;
