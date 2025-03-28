-- Add tts_enabled column to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS tts_enabled boolean DEFAULT true;

-- Add comment explaining the field
COMMENT ON COLUMN settings.tts_enabled IS 'Whether text-to-speech is enabled for the user'; 