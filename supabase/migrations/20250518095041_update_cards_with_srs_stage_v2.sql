-- Migration: Update cards_with_srs_stage view to use srs_level and learning_state
-- Version: 2
-- Description: This migration updates the public.cards_with_srs_stage view
--              to classify cards based on their srs_level and learning_state,
--              aligning with the application's core SRS state model.
--              It introduces 'relearning' as a distinct stage visible in the view.

-- Drop the existing view if it exists to ensure a clean re-creation
DROP VIEW IF EXISTS public.cards_with_srs_stage;

-- Create the new view with updated logic
CREATE OR REPLACE VIEW public.cards_with_srs_stage AS
SELECT
    c.id,
    c.deck_id,
    c.user_id,
    c.question,
    c.answer,
    c.created_at,
    c.updated_at,
    c.last_reviewed_at,
    c.next_review_due,
    c.srs_level,
    c.easiness_factor,
    c.interval_days,
    c.learning_state,
    c.learning_step_index,
    c.failed_attempts_in_learn,
    c.hard_attempts_in_learn,
    c.stability,
    c.difficulty,
    c.last_review_grade,
    c.correct_count,
    c.incorrect_count,
    c.attempt_count,
    c.question_part_of_speech,
    c.question_gender,
    c.answer_part_of_speech,
    c.answer_gender,
    s.mature_interval_threshold, -- Include for reference or potential future use
    CASE
        -- Card is 'new' if it has srs_level 0 and no learning_state (never started learning)
        WHEN c.srs_level = 0 AND c.learning_state IS NULL THEN 'new'::text
        -- Card is 'learning' if srs_level 0 and in 'learning' state (initial learning steps)
        WHEN c.srs_level = 0 AND c.learning_state = 'learning' THEN 'learning'::text
        -- Card is 'relearning' if srs_level 0 and in 'relearning' state (lapsed and in relearning steps)
        WHEN c.srs_level = 0 AND c.learning_state = 'relearning' THEN 'relearning'::text
        -- Card is 'young' if it's in review (srs_level >= 1), has a positive interval,
        -- and its interval is less than the mature_interval_threshold from user settings.
        WHEN c.srs_level >= 1 AND c.interval_days > 0 AND c.interval_days < COALESCE(s.mature_interval_threshold, 21) THEN 'young'::text
        -- Card is 'mature' if it's in review (srs_level >= 1), has a positive interval,
        -- and its interval is greater than or equal to the mature_interval_threshold.
        WHEN c.srs_level >= 1 AND c.interval_days >= COALESCE(s.mature_interval_threshold, 21) THEN 'mature'::text
        -- Fallback for any other unexpected state (should ideally not be hit if data is consistent)
        ELSE 'unknown'::text
    END AS srs_stage
FROM
    public.cards c
    -- LEFT JOIN settings on user_id to get the mature_interval_threshold.
    -- Using LEFT JOIN ensures cards are still included even if a user has no settings row (though unlikely).
    LEFT JOIN public.settings s ON c.user_id = s.user_id;

-- Add comment to the updated view
COMMENT ON VIEW public.cards_with_srs_stage IS 'Extends cards with calculated SRS stage (new, learning, relearning, young, mature) based on srs_level, learning_state, interval_days, and user settings. Version 2.';

-- RLS: Row Level Security for this view will be inherited from the underlying 'public.cards' table.
-- Ensure 'public.cards' RLS policies correctly restrict access based on auth.uid() = cards.user_id.
-- Ensure 'public.settings' RLS policies correctly restrict access based on auth.uid() = settings.user_id if the view is not SECURITY DEFINER.
-- If direct access to settings by any user querying the view is a concern and SECURITY INVOKER is used,
-- ensure appropriate RLS on 'settings' table or consider making the view SECURITY DEFINER if necessary and safe.
-- For now, assuming SECURITY INVOKER and that RLS on underlying tables is sufficient.

-- No separate GRANT statements are typically needed for views if the user has permissions on the underlying tables,
-- unless specific view-level permissions are desired.