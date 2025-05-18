-- Migration: Refine resolve_study_query function for 'includeLearning'
-- Version: 9
-- Description: This migration updates the public.resolve_study_query(uuid, jsonb) function
--              to ensure the 'includeLearning' filter correctly includes cards that are
--              srs_level = 0 AND (learning_state IS NULL OR learning_state = 'learning').
--              This aligns its behavior with the learn eligibility count and useStudySession filter.

-- Drop the existing function to ensure a clean re-creation
DROP FUNCTION IF EXISTS public.resolve_study_query(uuid, jsonb);
DROP FUNCTION IF EXISTS public.resolve_study_query(jsonb, uuid); -- Drop older signature if it exists

-- Recreate the function with updated logic
CREATE OR REPLACE FUNCTION public.resolve_study_query(
    p_user_id uuid,
    p_query_criteria jsonb
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_sql                  TEXT;
    v_from_clause          TEXT := 'FROM public.cards c';
    v_where_clauses        TEXT[] := ARRAY[]::TEXT[];

    -- Parsed criteria variables
    v_deck_id              UUID;
    v_include_tags         UUID[];
    v_exclude_tags         UUID[];
    v_tag_logic            TEXT;
    v_srs_level_op         TEXT;
    v_srs_level_value      INT;
    v_include_learning     BOOLEAN;

    -- Date related variables
    v_date_field_key       TEXT;
    v_date_field_keys      TEXT[] := ARRAY['createdDate', 'updatedDate', 'lastReviewed', 'nextReviewDue'];
    v_db_column            TEXT;
    v_date_op_json         TEXT;
    v_date_val_json        TEXT;
    v_date_range_json      JSONB;
    v_start_date           TEXT;
    v_end_date             TEXT;
    v_current_date_clauses TEXT[];
BEGIN
    RAISE LOG '[resolve_study_query_v9] User: %, Criteria: %', p_user_id, p_query_criteria;

    v_where_clauses := array_append(v_where_clauses, format('c.user_id = %L', p_user_id));

    v_deck_id := p_query_criteria->>'deckId';
    v_tag_logic := COALESCE(p_query_criteria->>'tagLogic', 'ANY');
    v_include_learning := COALESCE((p_query_criteria->>'includeLearning')::BOOLEAN, FALSE);

    IF jsonb_typeof(p_query_criteria->'includeTags') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_include_tags FROM jsonb_array_elements_text(p_query_criteria->'includeTags') elem;
    END IF;
    v_include_tags := COALESCE(v_include_tags, ARRAY[]::UUID[]);

    IF jsonb_typeof(p_query_criteria->'excludeTags') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_exclude_tags FROM jsonb_array_elements_text(p_query_criteria->'excludeTags') elem;
    END IF;
    v_exclude_tags := COALESCE(v_exclude_tags, ARRAY[]::UUID[]);

    IF v_deck_id IS NOT NULL THEN
        v_where_clauses := array_append(v_where_clauses, format('c.deck_id = %L', v_deck_id));
    END IF;

    IF array_length(v_include_tags, 1) > 0 THEN
        IF v_tag_logic = 'ALL' THEN
             v_where_clauses := array_append(v_where_clauses, format(
                'c.deck_id IN (SELECT dt.deck_id FROM public.deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]) GROUP BY dt.deck_id HAVING count(DISTINCT dt.tag_id) = %s)',
                p_user_id, v_include_tags, array_length(v_include_tags,1) ));
        ELSE
            v_where_clauses := array_append(v_where_clauses, format(
                'c.deck_id IN (SELECT DISTINCT dt.deck_id FROM public.deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]))',
                p_user_id, v_include_tags ));
        END IF;
    END IF;
    IF array_length(v_exclude_tags, 1) > 0 THEN
        v_where_clauses := array_append(v_where_clauses, format(
            'c.deck_id NOT IN (SELECT DISTINCT dt.deck_id FROM public.deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]))',
             p_user_id, v_exclude_tags ));
    END IF;

    -- CORRECTED 'includeLearning' filter
    IF v_include_learning IS TRUE THEN
        v_where_clauses := array_append(v_where_clauses, '(c.srs_level = 0 AND (c.learning_state IS NULL OR c.learning_state = ''learning''))');
        RAISE LOG '[resolve_study_query_v9] Applied corrected includeLearning filter.';
    END IF;

    v_srs_level_op := p_query_criteria->'srsLevel'->>'operator';
    IF p_query_criteria->'srsLevel'->>'value' IS NOT NULL AND p_query_criteria->'srsLevel'->>'value' ~ '^\d+$' THEN
       v_srs_level_value := (p_query_criteria->'srsLevel'->>'value')::INT;
    ELSE
       v_srs_level_value := NULL;
    END IF;

    IF v_srs_level_op IS NOT NULL AND v_srs_level_value IS NOT NULL THEN
        CASE v_srs_level_op
            WHEN 'equals'    THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level = %s', v_srs_level_value));
            WHEN 'lessThan'  THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level < %s', v_srs_level_value));
            WHEN 'greaterThan' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level > %s', v_srs_level_value));
            ELSE
                 RAISE WARNING '[resolve_study_query_v9] Invalid srsLevel operator: "%" for User %. Filter ignored.', v_srs_level_op, p_user_id;
        END CASE;
    END IF;

    FOREACH v_date_field_key IN ARRAY v_date_field_keys LOOP
        v_current_date_clauses := ARRAY[]::TEXT[];
        v_db_column := CASE v_date_field_key
                         WHEN 'createdDate' THEN 'c.created_at'
                         WHEN 'updatedDate' THEN 'c.updated_at'
                         WHEN 'lastReviewed' THEN 'c.last_reviewed_at'
                         WHEN 'nextReviewDue' THEN 'c.next_review_due'
                         ELSE ''
                       END;
        v_date_op_json := p_query_criteria->v_date_field_key->>'operator';
        v_date_val_json := p_query_criteria->v_date_field_key->>'value';
        v_date_range_json := p_query_criteria->v_date_field_key->'value';

        IF v_date_op_json IS NOT NULL AND v_date_op_json <> 'any' THEN
            RAISE LOG '[resolve_study_query_v9] Processing date filter for %: op="%", val_json="%"', v_date_field_key, v_date_op_json, v_date_val_json;
            IF v_date_op_json = 'newerThanDays' AND v_date_val_json IS NOT NULL AND v_date_val_json ~ '^\d+$' THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('%s >= (NOW() - interval ''1 day'' * (%L::integer))', v_db_column, v_date_val_json));
            ELSIF v_date_op_json = 'olderThanDays' AND v_date_val_json IS NOT NULL AND v_date_val_json ~ '^\d+$' THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('%s < (NOW() - interval ''1 day'' * (%L::integer))', v_db_column, v_date_val_json));
            ELSIF v_date_op_json = 'onDate' AND v_date_val_json IS NOT NULL THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('%s::date = %L::date', v_db_column, v_date_val_json));
            ELSIF v_date_op_json = 'betweenDates' AND jsonb_typeof(v_date_range_json) = 'array' AND jsonb_array_length(v_date_range_json) = 2 THEN
                v_start_date := v_date_range_json->>0;
                v_end_date := v_date_range_json->>1;
                IF v_start_date IS NOT NULL AND v_start_date <> 'null' THEN
                    v_current_date_clauses := array_append(v_current_date_clauses, format('%s::date >= %L::date', v_db_column, v_start_date));
                END IF;
                IF v_end_date IS NOT NULL AND v_end_date <> 'null' THEN
                    v_current_date_clauses := array_append(v_current_date_clauses, format('%s::date <= %L::date', v_db_column, v_end_date));
                END IF;
            ELSIF v_date_op_json = 'never' AND (v_date_field_key = 'lastReviewed' OR v_date_field_key = 'nextReviewDue') THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('%s IS NULL', v_db_column));
            ELSIF v_date_op_json = 'isDue' AND v_date_field_key = 'nextReviewDue' THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('(%s IS NULL OR %s <= NOW())', v_db_column, v_db_column));
            ELSE
                 RAISE WARNING '[resolve_study_query_v9] Invalid or unhandled date operator: "%" for field %, User %. Filter ignored.', v_date_op_json, v_db_column, p_user_id;
            END IF;

            IF (v_date_op_json IN ('newerThanDays', 'olderThanDays', 'onDate', 'betweenDates')) AND
               (v_date_field_key = 'lastReviewed' OR v_date_field_key = 'nextReviewDue') AND
               array_length(v_current_date_clauses, 1) > 0 THEN
                v_current_date_clauses := array_prepend(format('%s IS NOT NULL', v_db_column), v_current_date_clauses);
            END IF;

            IF array_length(v_current_date_clauses, 1) > 0 THEN
                 v_where_clauses := array_append(v_where_clauses, '(' || array_to_string(v_current_date_clauses, ' AND ') || ')');
            END IF;
        END IF;
    END LOOP;

    v_sql := 'SELECT c.id ' || v_from_clause;
    IF array_length(v_where_clauses, 1) > 0 THEN
        v_sql := v_sql || ' WHERE ' || array_to_string(v_where_clauses, ' AND ');
    END IF;
    v_sql := v_sql || ' ORDER BY c.created_at DESC, c.id DESC NULLS LAST';

    RAISE LOG '[resolve_study_query_v9] Final SQL: %', v_sql;
    RETURN QUERY EXECUTE v_sql;

EXCEPTION WHEN others THEN
    RAISE WARNING '[resolve_study_query_v9] Error for User: %, Criteria: %. Error: %', p_user_id, p_query_criteria, SQLERRM;
    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_study_query(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.resolve_study_query(uuid, jsonb) IS
'Resolves study query criteria JSON into a list of matching card IDs. v9: Corrected includeLearning filter to include srs_level=0 AND (learning_state IS NULL OR learning_state = ''learning'').';