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

-- Add columns for PDF Export settings
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS enable_pdf_word_color_coding BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pdf_card_content_font_size INTEGER NOT NULL DEFAULT 10;

COMMENT ON COLUMN public.settings.enable_pdf_word_color_coding IS 'Enables/disables word color coding in PDF exports. Default: TRUE.';
COMMENT ON COLUMN public.settings.pdf_card_content_font_size IS 'Font size for card content in PDF exports. Default: 10.';

-- Add column for showing card status icons in PDF
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS show_card_status_icons_in_pdf BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.settings.show_card_status_icons_in_pdf IS 'Shows/hides status icons (new, relearning) for cards in PDF exports. Default: TRUE.';

COMMIT;