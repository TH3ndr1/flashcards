-- migrate:up
-- UP Migration: Add study-related columns and index
-- Add new columns to the cards table for tracking learning/relearning state
ALTER TABLE public.cards
ADD COLUMN IF NOT EXISTS learning_state text NULL,
ADD COLUMN IF NOT EXISTS learning_step_index integer NULL,
ADD COLUMN IF NOT EXISTS failed_attempts_in_learn integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS hard_attempts_in_learn integer NOT NULL DEFAULT 0;

-- Add comments for the new cards columns
COMMENT ON COLUMN public.cards.learning_state IS 'Tracks if a card is in initial learning (''learning'') or relearning (''relearning'') state.';
COMMENT ON COLUMN public.cards.learning_step_index IS 'Tracks the current step index within the learning or relearning phase.';
COMMENT ON COLUMN public.cards.failed_attempts_in_learn IS 'Counts ''Again'' (Grade 1) answers during initial learning for EF calculation.';
COMMENT ON COLUMN public.cards.hard_attempts_in_learn IS 'Counts ''Hard'' (Grade 2) answers during initial learning for EF calculation.';

-- Drop the dependent view before altering the column type
DROP VIEW IF EXISTS public.cards_with_srs_stage;

-- Change interval_days type to float to support fractional intervals for learning steps
ALTER TABLE public.cards
ALTER COLUMN interval_days TYPE float USING interval_days::float;
-- Note: The NOT NULL DEFAULT 0 constraint is preserved by ALTER TYPE

-- Set easiness_factor to NOT NULL as it should always have a value (default 2.5)
ALTER TABLE public.cards
ALTER COLUMN easiness_factor SET NOT NULL;

-- Add new columns to the settings table for study algorithm parameters
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS enable_dedicated_learn_mode boolean NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS mastery_threshold integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS custom_learn_requeue_gap integer NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS graduating_interval_days integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS easy_interval_days integer NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS relearning_steps_minutes integer[] NOT NULL DEFAULT '{}'::integer[],
ADD COLUMN IF NOT EXISTS initial_learning_steps_minutes integer[] NOT NULL DEFAULT '{}'::integer[],
ADD COLUMN IF NOT EXISTS lapsed_ef_penalty numeric NOT NULL DEFAULT 0.2,
ADD COLUMN IF NOT EXISTS learn_again_penalty numeric NOT NULL DEFAULT 0.2,
ADD COLUMN IF NOT EXISTS learn_hard_penalty numeric NOT NULL DEFAULT 0.05,
ADD COLUMN IF NOT EXISTS min_easiness_factor numeric NOT NULL DEFAULT 1.3,
ADD COLUMN IF NOT EXISTS default_easiness_factor numeric NOT NULL DEFAULT 2.5;

-- Add comments for the new settings columns
COMMENT ON COLUMN public.settings.enable_dedicated_learn_mode IS 'Flag to use the dedicated streak-based learning mode (vs standard SM2 steps).';
COMMENT ON COLUMN public.settings.mastery_threshold IS 'Required streak/success count to graduate from dedicated learn mode.';
COMMENT ON COLUMN public.settings.custom_learn_requeue_gap IS 'Number of other cards to show before re-queueing a failed card in dedicated learn mode.';
COMMENT ON COLUMN public.settings.graduating_interval_days IS 'Initial interval (days) assigned when a card graduates from learning/relearning.';
COMMENT ON COLUMN public.settings.easy_interval_days IS 'Interval (days) assigned when graduating with ''Easy'' (Grade 4).';
COMMENT ON COLUMN public.settings.relearning_steps_minutes IS 'Intervals (in minutes) for steps during relearning phase (e.g., {10, 1440} for 10m, 1d).';
COMMENT ON COLUMN public.settings.initial_learning_steps_minutes IS 'Intervals (in minutes) for steps during initial learning phase (standard SM2 algorithm; e.g., {1, 10}).';
COMMENT ON COLUMN public.settings.lapsed_ef_penalty IS 'Amount subtracted from easiness factor when a card lapses.';
COMMENT ON COLUMN public.settings.learn_again_penalty IS 'Penalty subtracted from initial EF per ''Again'' (Grade 1) in dedicated learn.';
COMMENT ON COLUMN public.settings.learn_hard_penalty IS 'Penalty subtracted from initial EF per ''Hard'' (Grade 2) in dedicated learn.';
COMMENT ON COLUMN public.settings.min_easiness_factor IS 'Minimum allowed easiness factor.';
COMMENT ON COLUMN public.settings.default_easiness_factor IS 'Default starting easiness factor for new cards.';

-- Recreate the view after altering the base table
CREATE OR REPLACE VIEW public.cards_with_srs_stage AS
SELECT
    c.*, -- Select all columns from cards
    COALESCE(s.mature_interval_threshold, 21) AS card_mature_threshold_days, -- Include the threshold used for debugging/info
    CASE
        WHEN c.last_reviewed_at IS NULL THEN 'new'::text -- We haven't seen this card before. It's waiting for its first turn.
        WHEN COALESCE(c.interval_days, 0) = 0 OR c.last_review_grade = 1 THEN 'learning'::text -- This card is still tricky, so we look at it a lot to help it stick.
        WHEN COALESCE(c.interval_days, 0) < COALESCE(s.mature_interval_threshold, 21) THEN 'young'::text -- We remember this card pretty well, but we still check it every so often to keep it fresh.
        ELSE 'mature'::text -- We know this card really well, so we only peek at it now and then to stay sharp.
    END AS srs_stage
FROM
    public.cards c
    -- Left join settings on user_id to get the threshold
    LEFT JOIN public.settings s ON c.user_id = s.user_id;

-- Add an index to optimize queries filtering by user and SRS state
CREATE INDEX IF NOT EXISTS cards_user_id_srs_state_idx ON public.cards (user_id, srs_level, learning_state);

