-- Add font settings column to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS card_font VARCHAR(20) DEFAULT 'default';

-- Create an enum type for font options
DO $$ BEGIN
    CREATE TYPE font_option AS ENUM ('default', 'opendyslexic', 'atkinson');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update existing rows to have the default value
UPDATE settings
SET card_font = 'default'
WHERE card_font IS NULL; 