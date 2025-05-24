-- Migration: Create get_user_study_sets_with_total_counts function
-- Version: 1
-- Description: This migration creates the public.get_user_study_sets_with_total_counts(uuid) function.
--              This function retrieves all study sets for a user and calculates the total card count for each.

DROP FUNCTION IF EXISTS public.get_user_study_sets_with_total_counts(uuid);
DROP TYPE IF EXISTS public.study_set_with_total_count;

-- Define a type that includes all fields from study_sets plus the total_card_count
CREATE TYPE public.study_set_with_total_count AS (
    id uuid,
    user_id uuid,
    name TEXT,
    description TEXT,
    query_criteria JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    total_card_count BIGINT
);

CREATE OR REPLACE FUNCTION public.get_user_study_sets_with_total_counts(
    p_user_id uuid
)
RETURNS SETOF public.study_set_with_total_count -- Returns a table of the new type
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    r_study_set RECORD;
    v_count BIGINT;
    v_result public.study_set_with_total_count;
BEGIN
    RAISE LOG '[get_user_study_sets_with_total_counts] User: %', p_user_id;

    FOR r_study_set IN
        SELECT *
        FROM public.study_sets
        WHERE study_sets.user_id = p_user_id
        ORDER BY study_sets.name -- Optional: order by name or updated_at
    LOOP
        -- Call the existing function to get the count for the current study set's criteria
        SELECT public.get_study_set_card_count(p_user_id, r_study_set.query_criteria)
        INTO v_count;

        v_result.id := r_study_set.id;
        v_result.user_id := r_study_set.user_id;
        v_result.name := r_study_set.name;
        v_result.description := r_study_set.description;
        v_result.query_criteria := r_study_set.query_criteria;
        v_result.created_at := r_study_set.created_at;
        v_result.updated_at := r_study_set.updated_at;
        v_result.total_card_count := COALESCE(v_count, 0); -- Ensure count is not null

        RETURN NEXT v_result;
    END LOOP;

    RETURN;

EXCEPTION WHEN others THEN
    RAISE WARNING '[get_user_study_sets_with_total_counts] Error for User: %. Error: %', p_user_id, SQLERRM;
    -- In case of an error, we might return an empty set or handle it differently
    -- For now, let the exception propagate or return nothing.
    RETURN; 
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_study_sets_with_total_counts(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_user_study_sets_with_total_counts(uuid) IS
'Retrieves all study sets for a user, along with the total card count for each set based on its query_criteria. v1.';

COMMENT ON TYPE public.study_set_with_total_count IS 
'Represents a study set record along with its dynamically calculated total card count.'; 