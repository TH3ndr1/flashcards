-- supabase/migrations/YYYYMMDDHHMMSS_add_final_feature_settings.sql

BEGIN;

-- Add columns for Study Timer feature
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS enable_study_timer BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS study_timer_duration_minutes INTEGER NOT NULL DEFAULT 25;

COMMENT ON COLUMN public.settings.enable_study_timer IS 'Enables/disables the study session timer. Default: FALSE.';
COMMENT ON COLUMN public.settings.study_timer_duration_minutes IS 'Duration of the study timer in minutes. Default: 25.';

-- Add column for UI Language preference
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS ui_language TEXT NOT NULL DEFAULT 'en';

COMMENT ON COLUMN public.settings.ui_language IS 'User preferred language for the application UI. Default: ''en''. BCP-47 language tag.';

-- Add columns for Deck List Grouping and Sorting preference
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS deck_list_grouping_mode TEXT NOT NULL DEFAULT 'none', -- e.g., 'none', 'language', 'tag'
ADD COLUMN IF NOT EXISTS deck_list_sort_field TEXT NOT NULL DEFAULT 'name',    -- e.g., 'name', 'updated_at', 'totalCards'
ADD COLUMN IF NOT EXISTS deck_list_sort_direction TEXT NOT NULL DEFAULT 'asc'; -- 'asc', 'desc'

COMMENT ON COLUMN public.settings.deck_list_grouping_mode IS 'Preference for grouping decks on overview pages. Default: ''none''.';
COMMENT ON COLUMN public.settings.deck_list_sort_field IS 'Field to sort decks by on overview pages. Default: ''name''.';
COMMENT ON COLUMN public.settings.deck_list_sort_direction IS 'Sort direction for decks on overview pages. Default: ''asc''.';

COMMIT;