-- introduce new column 'mature_interval_threshold' to settings table
ALTER TABLE public.settings
ADD COLUMN mature_interval_threshold INTEGER DEFAULT 21 NOT NULL;

COMMENT ON COLUMN public.settings.mature_interval_threshold IS 'SRS interval (days) threshold for a card to be considered mature (default: 21).';


-- Drop the previous view if it exists
DROP VIEW IF EXISTS public.cards_with_difficulty;

-- Create the new view joining cards and settings to catch the mature_threshold_days parameter which is 21 by default
CREATE VIEW public.cards_with_srs_stage AS
SELECT
    c.*, -- Select all columns from cards
    COALESCE(s.mature_interval_threshold, 21) AS card_mature_threshold_days, -- Include the threshold used for debugging/info
    CASE
        WHEN c.last_reviewed_at IS NULL THEN 'new'::text -- We haven’t seen this card before. It’s waiting for its first turn.
        WHEN COALESCE(c.interval_days, 0) = 0 OR c.last_review_grade = 1 THEN 'learning'::text -- This card is still tricky, so we look at it a lot to help it stick.
        WHEN COALESCE(c.interval_days, 0) < COALESCE(s.mature_interval_threshold, 21) THEN 'young'::text -- We remember this card pretty well, but we still check it every so often to keep it fresh.
        ELSE 'mature'::text -- We know this card really well, so we only peek at it now and then to stay sharp.
    END AS srs_stage
FROM
    public.cards c
    -- Left join settings on user_id to get the threshold
    LEFT JOIN public.settings s ON c.user_id = s.user_id;

-- Add comment
COMMENT ON VIEW public.cards_with_srs_stage IS 'Extends cards with calculated SRS stage (new, learning, young, mature) based on SRS state and user settings.';

-- to improve performance of the view, we create a composite btree index on the user_id and mature_interval_threshold columns
-- create the composite btree index
CREATE INDEX IF NOT EXISTS settings_userid_maturethreshold_idx
    ON public.settings
    USING btree (user_id, mature_interval_threshold);



-- IMPORTANT: Ensure RLS is already enabled and correctly configured on the base table 'public.cards'
--            (e.g., checking auth.uid() = user_id)
--            No separate RLS enablement or policies are needed DIRECTLY on the view here.

