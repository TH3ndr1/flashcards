-- supabase/migrations/YYYYMMDDHHMMSS_add_all_new_feature_settings.sql

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

-- Add column for Deck List Grouping preference
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS deck_list_grouping_preference TEXT NOT NULL DEFAULT 'none';
-- Example for a more constrained type if desired in the future:
-- ADD CONSTRAINT valid_deck_grouping CHECK (deck_list_grouping_preference IN ('none', 'tag', 'language', 'language_then_tag', 'tag_then_language'));

COMMENT ON COLUMN public.settings.deck_list_grouping_preference IS 'User preference for grouping decks on overview pages (e.g., ''none'', ''tag'', ''language'', ''language,tag''). Default: ''none''.';

-- Note: study_algorithm and enable_dedicated_learn_mode were added by a previous migration (20250501154500).
-- No changes to them are needed in *this specific* migration script unless their defaults or constraints need adjustment
-- in light of these new settings, which is not currently indicated.

COMMIT;