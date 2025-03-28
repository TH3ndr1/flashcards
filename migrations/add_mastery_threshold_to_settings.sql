-- Add mastery_threshold column to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS mastery_threshold INTEGER DEFAULT 3;

-- Update existing rows to have the default value
UPDATE settings
SET mastery_threshold = 3
WHERE mastery_threshold IS NULL; 