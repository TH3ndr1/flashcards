-- Migration: Create get_user_global_srs_summary function
-- Version: 1
-- Description: This migration creates the public.get_user_global_srs_summary(uuid) function.
--              This function calculates total, new, due, and new_review card counts for all cards belonging to a user.

DROP FUNCTION IF EXISTS public.get_user_global_srs_summary(uuid);
DROP TYPE IF EXISTS public.user_global_srs_summary_counts;

CREATE TYPE public.user_global_srs_summary_counts AS (
    total_cards BIGINT,
    new_cards BIGINT,
    due_cards BIGINT,
    new_review_cards BIGINT
);

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
    WHERE c.user_id = p_user_id;
    
    RETURN v_summary_result;

EXCEPTION WHEN others THEN
    RAISE WARNING '[get_user_global_srs_summary] Error for User: %. Error: %', p_user_id, SQLERRM;
    RETURN (0,0,0,0)::public.user_global_srs_summary_counts; -- Return zero counts on error
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_global_srs_summary(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_user_global_srs_summary(uuid) IS
'Calculates total, new, due, and new_review card counts for all cards of a given user. v1.'; 