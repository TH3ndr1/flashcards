BEGIN;

-- Update get_user_global_srs_summary function to only count active cards
-- COMPLETE IMPLEMENTATION WITH EXACT BUSINESS LOGIC
DROP FUNCTION IF EXISTS public.get_user_global_srs_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_user_global_srs_summary(
  p_user_id uuid
)
RETURNS public.user_global_srs_summary_counts
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_summary_result public.user_global_srs_summary_counts;
    v_mature_threshold INTEGER;
BEGIN
    RAISE LOG '[get_user_global_srs_summary] User: %', p_user_id;

    -- Fetch mature_interval_threshold from settings for the current user, though not directly used for these specific counts,
    -- it's good practice if we were to extend this to young/mature for global counts.
    -- For now, it's not strictly needed for total, new, due, new_review.
    SELECT s.mature_interval_threshold INTO v_mature_threshold
    FROM public.settings s
    WHERE s.user_id = p_user_id
    LIMIT 1;
    v_mature_threshold := COALESCE(v_mature_threshold, 21); -- Default if not found

    SELECT
        COUNT(*)::BIGINT AS total_cards,
        COALESCE(SUM(CASE WHEN c.srs_level = 0 THEN 1 ELSE 0 END), 0)::BIGINT AS new_cards,
        COALESCE(SUM(CASE 
            WHEN (c.next_review_due IS NOT NULL AND c.next_review_due <= NOW()) 
                 AND c.learning_state IS DISTINCT FROM 'learning' 
                 AND c.learning_state IS DISTINCT FROM 'relearning' 
            THEN 1 
            ELSE 0 
        END), 0)::BIGINT AS due_cards,
        COALESCE(SUM(CASE 
            WHEN c.srs_level = 0 OR 
                 ((c.next_review_due IS NOT NULL AND c.next_review_due <= NOW()) 
                  AND c.learning_state IS DISTINCT FROM 'learning' 
                  AND c.learning_state IS DISTINCT FROM 'relearning') 
            THEN 1 
            ELSE 0 
        END), 0)::BIGINT AS new_review_cards
    INTO v_summary_result
    FROM public.cards c
    JOIN public.decks d ON c.deck_id = d.id
    WHERE c.user_id = p_user_id
      AND c.status = 'active'
      AND d.status = 'active';
    
    RETURN v_summary_result;

EXCEPTION WHEN others THEN
    RAISE WARNING '[get_user_global_srs_summary] Error for User: %. Error: %', p_user_id, SQLERRM;
    RETURN (0,0,0,0)::public.user_global_srs_summary_counts; -- Return zero counts on error
END;
$$;

COMMENT ON FUNCTION public.get_user_global_srs_summary(uuid)
IS 'Get global SRS summary counts for a user, only including active cards from active decks.';

GRANT EXECUTE ON FUNCTION public.get_user_global_srs_summary(uuid) TO authenticated;

COMMIT;
