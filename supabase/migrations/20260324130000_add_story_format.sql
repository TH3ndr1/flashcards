-- Add story_format column to support different AI generation modes
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS story_format TEXT NOT NULL DEFAULT 'narrative'
    CHECK (story_format IN ('narrative', 'summary', 'dialogue', 'analogy'));

-- Extend reading_time_min to allow 0 (= "minimal" — shortest impactful content)
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_reading_time_min_check;
ALTER TABLE stories ADD CONSTRAINT stories_reading_time_min_check
  CHECK (reading_time_min IN (0, 5, 10, 20));
