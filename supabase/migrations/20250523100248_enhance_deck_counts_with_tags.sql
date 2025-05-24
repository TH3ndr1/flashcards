BEGIN;

-- Drop the existing function to redefine it
DROP FUNCTION IF EXISTS public.get_decks_with_complete_srs_counts(uuid);

-- Recreate the function with the new deck_tags_json column
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
  new_count bigint,
  learning_count bigint,
  young_count bigint,
  mature_count bigint,
  relearning_count bigint,
  learn_eligible_count bigint,
  review_eligible_count bigint,
  deck_tags_json jsonb -- NEW COLUMN for aggregated tags
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
srs_counts AS (
  SELECT
    c.deck_id,
    COUNT(*) FILTER (WHERE c.srs_level = 0 AND c.learning_state IS NULL) AS new_count, -- More precise 'new'
    COUNT(*) FILTER (WHERE c.srs_level = 0 AND c.learning_state = 'learning') AS learning_count,
    COUNT(*) FILTER (WHERE c.srs_level = 0 AND c.learning_state = 'relearning') AS relearning_count,
    COUNT(*) FILTER (WHERE c.srs_level >= 1 AND c.learning_state IS NULL AND COALESCE(c.interval_days, 0) < COALESCE((SELECT s.mature_interval_threshold FROM public.settings s WHERE s.user_id = c.user_id LIMIT 1), 21)) AS young_count,
    COUNT(*) FILTER (WHERE c.srs_level >= 1 AND c.learning_state IS NULL AND COALESCE(c.interval_days, 0) >= COALESCE((SELECT s.mature_interval_threshold FROM public.settings s WHERE s.user_id = c.user_id LIMIT 1), 21)) AS mature_count,
    COUNT(*) FILTER (WHERE c.srs_level = 0 AND (c.learning_state IS NULL OR c.learning_state = 'learning')) AS learn_eligible_count,
    COUNT(*) FILTER (WHERE ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = 'relearning')) AND c.next_review_due <= CURRENT_TIMESTAMP) AS review_eligible_count
  FROM
    public.cards c
  WHERE
    c.user_id = p_user_id
    AND c.deck_id IN (SELECT id FROM deck_base)
  GROUP BY
    c.deck_id
),
deck_tags_agg AS ( -- NEW CTE to aggregate tags for each deck
  SELECT
    dt.deck_id,
    jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)) AS tags_json
  FROM
    public.deck_tags dt
  JOIN
    public.tags t ON dt.tag_id = t.id
  WHERE
    dt.user_id = p_user_id -- Ensure we only consider tags linked by the user to their decks
    AND dt.deck_id IN (SELECT id FROM deck_base)
  GROUP BY
    dt.deck_id
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
  COALESCE(s.mature_count, 0) AS mature_count,
  COALESCE(s.relearning_count, 0) AS relearning_count,
  COALESCE(s.learn_eligible_count, 0) AS learn_eligible_count,
  COALESCE(s.review_eligible_count, 0) AS review_eligible_count,
  COALESCE(dta.tags_json, '[]'::jsonb) AS deck_tags_json -- Use empty JSON array if no tags
FROM
  deck_base d
LEFT JOIN
  srs_counts s ON d.id = s.deck_id
LEFT JOIN
  deck_tags_agg dta ON d.id = dta.deck_id -- JOIN with aggregated tags
ORDER BY
  d.name ASC;
$$;

COMMENT ON FUNCTION public.get_decks_with_complete_srs_counts(uuid)
IS 'Retrieves all decks for a user with complete SRS information and associated tags. Includes standard SRS stage counts and eligible counts for learn/review modes. Version 2: Added deck_tags_json.';

-- Grant execute should already exist, but re-applying is safe.
GRANT EXECUTE ON FUNCTION public.get_decks_with_complete_srs_counts(uuid) TO authenticated;

COMMIT;