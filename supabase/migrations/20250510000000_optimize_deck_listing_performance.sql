-- migrate:up
-- Fix function signature to match how it's called by the application

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.get_deck_list_with_srs_counts(uuid);

CREATE OR REPLACE FUNCTION public.get_deck_list_with_srs_counts(
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  primary_language text,
  secondary_language text,
  is_bilingual boolean,
  updated_at timestamptz,
  new_count bigint,
  learning_count bigint,
  young_count bigint,
  mature_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH deck_base AS (
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
srs_counts AS (
  SELECT
    c.deck_id,
    COUNT(*) FILTER (WHERE c.last_reviewed_at IS NULL) AS new_count,
    COUNT(*) FILTER (WHERE c.last_reviewed_at IS NOT NULL AND 
                    (COALESCE(c.interval_days, 0) = 0 OR c.last_review_grade = 1)) AS learning_count,
    COUNT(*) FILTER (WHERE c.last_reviewed_at IS NOT NULL AND
                    COALESCE(c.interval_days, 0) > 0 AND 
                    c.last_review_grade != 1 AND
                    COALESCE(c.interval_days, 0) < COALESCE(
                        (SELECT mature_interval_threshold FROM public.settings WHERE user_id = p_user_id), 
                        21)) AS young_count,
    COUNT(*) FILTER (WHERE c.last_reviewed_at IS NOT NULL AND
                    COALESCE(c.interval_days, 0) > 0 AND 
                    c.last_review_grade != 1 AND
                    COALESCE(c.interval_days, 0) >= COALESCE(
                        (SELECT mature_interval_threshold FROM public.settings WHERE user_id = p_user_id), 
                        21)) AS mature_count
  FROM
    public.cards c
  WHERE
    c.user_id = p_user_id
    AND c.deck_id IN (SELECT id FROM deck_base)
  GROUP BY
    c.deck_id
)
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
  COALESCE(s.mature_count, 0) AS mature_count
FROM
  deck_base d
LEFT JOIN
  srs_counts s ON d.id = s.deck_id
ORDER BY
  d.name ASC;
$$;

COMMENT ON FUNCTION public.get_deck_list_with_srs_counts(uuid)
IS 'Retrieves all decks for a user along with counts of cards in each SRS stage (new, learning, young, mature). Optimized version that avoids using the full view.';

GRANT EXECUTE ON FUNCTION public.get_deck_list_with_srs_counts(uuid) TO authenticated;