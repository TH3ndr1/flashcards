-- Add language_dialects column to settings table
ALTER TABLE settings
ADD COLUMN IF NOT EXISTS language_dialects JSONB DEFAULT jsonb_build_object(
  'en', 'en-GB',
  'nl', 'nl-NL',
  'fr', 'fr-FR',
  'de', 'de-DE',
  'es', 'es-ES',
  'it', 'it-IT'
); 