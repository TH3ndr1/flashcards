DROP FUNCTION IF EXISTS public.get_decks_with_complete_srs_counts(uuid);

-- Add database function to fetch decks with complete SRS counts in one query

CREATE OR REPLACE FUNCTION public.get_decks_with_complete_srs_counts(
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  primary_language text,
  secondary_language text,
  is_bilingual boolean,
  updated_at timestamptz,
  new_count bigint,           -- Standard SRS stage counts
  learning_count bigint,
  young_count bigint,
  mature_count bigint,
  relearning_count bigint, -- Added for relearning cards
  learn_eligible_count bigint, -- New Learn button count
  review_eligible_count bigint -- New Review button count
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH 
deck_base AS (
  SELECT
    d.id,
    d.name,
    d.primary_language,
    d.secondary_language,
    d.is_bilingual,
    d.updated_at
  FROM
    public.decks d
  WHERE
    d.user_id = p_user_id
),
-- Calculate standard SRS stages
srs_counts AS (
  SELECT
    c.deck_id,
    COUNT(*) FILTER (WHERE c.last_reviewed_at IS NULL) AS new_count,
    COUNT(*) FILTER (WHERE c.learning_state = 'learning') AS learning_count,
    COUNT(*) FILTER (WHERE c.learning_state = 'relearning') AS relearning_count,
    COUNT(*) FILTER (WHERE c.last_reviewed_at IS NOT NULL AND
                    c.learning_state IS DISTINCT FROM 'learning' AND c.learning_state IS DISTINCT FROM 'relearning' AND
                    COALESCE(c.interval_days, 0) > 0 AND 
                    c.last_review_grade != 1 AND
                    COALESCE(c.interval_days, 0) < COALESCE(
                        (SELECT mature_interval_threshold FROM public.settings WHERE user_id = p_user_id), 
                        21)) AS young_count,
    COUNT(*) FILTER (WHERE c.last_reviewed_at IS NOT NULL AND
                    c.learning_state IS DISTINCT FROM 'learning' AND c.learning_state IS DISTINCT FROM 'relearning' AND
                    COALESCE(c.interval_days, 0) > 0 AND 
                    c.last_review_grade != 1 AND
                    COALESCE(c.interval_days, 0) >= COALESCE(
                        (SELECT mature_interval_threshold FROM public.settings WHERE user_id = p_user_id), 
                        21)) AS mature_count,
    -- Learn Mode eligibility: srs_level=0, learning_state=null or 'learning'
    COUNT(*) FILTER (WHERE c.srs_level = 0 AND 
                    (c.learning_state IS NULL OR c.learning_state = 'learning')) AS learn_eligible_count,
    -- Review Mode eligibility
    COUNT(*) FILTER (WHERE 
                    -- graduated or relearning
                    ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = 'relearning'))
                    -- and due for review
                    AND c.next_review_due <= CURRENT_TIMESTAMP) AS review_eligible_count
  FROM
    public.cards c
  WHERE
    c.user_id = p_user_id
    AND c.deck_id IN (SELECT id FROM deck_base)
  GROUP BY
    c.deck_id
)
-- Combine the data
SELECT
  d.id,
  d.name,
  d.primary_language,
  d.secondary_language,
  d.is_bilingual,
  d.updated_at,
  COALESCE(s.new_count, 0) AS new_count,
  COALESCE(s.learning_count, 0) AS learning_count,
  COALESCE(s.young_count, 0) AS young_count,
  COALESCE(s.mature_count, 0) AS mature_count,
  COALESCE(s.relearning_count, 0) AS relearning_count,
  COALESCE(s.learn_eligible_count, 0) AS learn_eligible_count,
  COALESCE(s.review_eligible_count, 0) AS review_eligible_count
FROM
  deck_base d
LEFT JOIN
  srs_counts s ON d.id = s.deck_id
ORDER BY
  d.name ASC;
$$;

COMMENT ON FUNCTION public.get_decks_with_complete_srs_counts(uuid)
IS 'Retrieves all decks for a user with complete SRS information in a single query. Includes standard SRS stage counts and eligible counts for learn/review modes.';

GRANT EXECUTE ON FUNCTION public.get_decks_with_complete_srs_counts(uuid) TO authenticated;