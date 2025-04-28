-- Migration: Add show_deck_progress setting

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS show_deck_progress BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.settings.show_deck_progress IS 'Whether to display the SRS stage progress bar on deck list items.'; 