-- Migration: Deprecate and remove the old get_deck_list_with_srs_counts function
-- Version: 1
-- Description: This migration removes the public.get_deck_list_with_srs_counts(uuid)
--              function as its functionality is superseded by
--              public.get_decks_with_complete_srs_counts(uuid), which provides
--              more comprehensive SRS stage and eligibility counts.

DROP FUNCTION IF EXISTS public.get_deck_list_with_srs_counts(uuid);

-- Optional: Add a comment if you want to record the deprecation reason in a more permanent way,
-- though the migration file itself serves this purpose.
-- COMMENT ON FUNCTION public.get_deck_list_with_srs_counts(uuid) IS 'DEPRECATED: Replaced by get_decks_with_complete_srs_counts(uuid) as of YYYY-MM-DD.';