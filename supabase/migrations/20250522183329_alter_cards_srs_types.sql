-- Migration script to update 'interval_days' data type in 'cards' table
-- and recreate dependent view 'cards_with_srs_stage'

BEGIN;

-- 1. Drop the dependent view
-- The original migration file also uses DROP VIEW IF EXISTS, which is good practice.
DROP VIEW IF EXISTS public.cards_with_srs_stage;

-- 2. Alter the table column type for 'interval_days'
ALTER TABLE public.cards
ALTER COLUMN interval_days TYPE REAL; -- Using REAL as discussed. Change to DOUBLE PRECISION if preferred.

-- 3. Recreate the view 'cards_with_srs_stage' using its exact definition
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
    c.interval_days, -- This column in the cards table is now REAL
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
    s.mature_interval_threshold,
    CASE
        WHEN c.srs_level = 0 AND c.learning_state IS NULL THEN 'new'::text
        WHEN c.srs_level = 0 AND c.learning_state = 'learning' THEN 'learning'::text
        WHEN c.srs_level = 0 AND c.learning_state = 'relearning' THEN 'relearning'::text
        WHEN c.srs_level >= 1 AND c.interval_days > 0 AND c.interval_days < COALESCE(s.mature_interval_threshold, 21) THEN 'young'::text
        WHEN c.srs_level >= 1 AND c.interval_days >= COALESCE(s.mature_interval_threshold, 21) THEN 'mature'::text
        ELSE 'unknown'::text
    END AS srs_stage
FROM
    public.cards c
    LEFT JOIN public.settings s ON c.user_id = s.user_id;

-- Add comments (Optional but good practice)
COMMENT ON COLUMN public.cards.interval_days IS 'SRS interval in days. Can be fractional for learning/relearning steps. (Type changed to REAL)';
COMMENT ON VIEW public.cards_with_srs_stage IS 'Extends cards with calculated SRS stage (new, learning, relearning, young, mature) based on srs_level, learning_state, interval_days, and user settings. Version 2. (Underlying cards.interval_days type updated)';

COMMIT;