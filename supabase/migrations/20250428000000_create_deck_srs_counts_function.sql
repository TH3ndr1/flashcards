-- Migration: Create function to get deck list with SRS stage counts

-- Drop function if it exists (optional, for idempotency during development)
DROP FUNCTION IF EXISTS public.get_deck_list_with_srs_counts(uuid);

-- Create the function
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
    new_count bigint,       -- Use bigint for counts
    learning_count bigint,
    young_count bigint,
    mature_count bigint
)
LANGUAGE sql
STABLE -- Function does not modify the database
SECURITY DEFINER -- To bypass RLS within the function if needed, ensure function owner has appropriate base table permissions
AS $$
SELECT
    d.id,
    d.name,
    d.primary_language,
    d.secondary_language,
    d.is_bilingual,
    d.updated_at,
    -- Aggregate counts for each SRS stage
    COUNT(cws.id) FILTER (WHERE cws.srs_stage = 'new') AS new_count,
    COUNT(cws.id) FILTER (WHERE cws.srs_stage = 'learning') AS learning_count,
    COUNT(cws.id) FILTER (WHERE cws.srs_stage = 'young') AS young_count,
    COUNT(cws.id) FILTER (WHERE cws.srs_stage = 'mature') AS mature_count
FROM
    public.decks d
LEFT JOIN
    -- Join with the view that calculates srs_stage
    public.cards_with_srs_stage cws ON d.id = cws.decak_id
WHERE
    -- Filter decks for the specified user
    d.user_id = p_user_id
GROUP BY
    -- Group by all selected deck fields to get per-deck counts
    d.id,
    d.name,
    d.primary_language,
    d.secondary_language,
    d.is_bilingual,
    d.updated_at
ORDER BY
    d.name ASC; -- Optional: order the results
$$;

-- Add comment to the function
COMMENT ON FUNCTION public.get_deck_list_with_srs_counts(uuid)
IS 'Retrieves all decks for a user along with counts of cards in each SRS stage (new, learning, young, mature).';

-- Grant execution rights to the authenticated role
-- Important: Ensure the 'authenticated' role exists and RLS on base tables (decks, cards) is correctly configured.
GRANT EXECUTE ON FUNCTION public.get_deck_list_with_srs_counts(uuid) TO authenticated;

-- Optional: Grant to service_role if called from backend bypassing RLS
-- GRANT EXECUTE ON FUNCTION public.get_deck_list_with_srs_counts(uuid) TO service_role; 