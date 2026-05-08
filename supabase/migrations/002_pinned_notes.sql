-- Add pinned column to notes
ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
