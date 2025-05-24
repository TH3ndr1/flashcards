-- Migration: Add performance indexes for study queries
-- Version: 1
-- Description: This migration adds several indexes to tables involved in study query resolution
-- (e.g., resolve_study_query, get_decks_with_complete_srs_counts) to improve performance
-- when fetching card IDs for playlists and deck lists.

BEGIN;

-- Indexes for public.cards table
CREATE INDEX IF NOT EXISTS cards_user_id_srs_state_idx ON public.cards (user_id, srs_level, learning_state);
COMMENT ON INDEX public.cards_user_id_srs_state_idx IS 'Optimizes queries filtering by user, SRS level, and learning state for cards.';

CREATE INDEX IF NOT EXISTS idx_cards_user_deck_reviewed ON public.cards (user_id, deck_id, last_reviewed_at, interval_days, last_review_grade);
COMMENT ON INDEX public.idx_cards_user_deck_reviewed IS 'Optimizes queries filtering by user, deck, and review-related attributes for cards.';

-- Index for public.deck_tags table
CREATE INDEX IF NOT EXISTS idx_deck_tags_user_tag_deck ON public.deck_tags (user_id, tag_id, deck_id);
COMMENT ON INDEX public.idx_deck_tags_user_tag_deck IS 'Optimizes queries filtering by user and tags to find relevant deck IDs.';

-- Indexes for public.decks table (for language filtering)
CREATE INDEX IF NOT EXISTS idx_decks_user_primary_language ON public.decks (user_id, primary_language);
COMMENT ON INDEX public.idx_decks_user_primary_language IS 'Optimizes queries filtering decks by user and primary language.';

CREATE INDEX IF NOT EXISTS idx_decks_user_secondary_lang_bilingual ON public.decks (user_id, secondary_language, is_bilingual);
COMMENT ON INDEX public.idx_decks_user_secondary_lang_bilingual IS 'Optimizes queries filtering decks by user, secondary language, and bilingual status.';

COMMIT; 