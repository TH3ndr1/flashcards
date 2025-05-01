-- Migration file: YYYYMMDDHHMMSS_update_resolve_study_query_difficult_logic_v3.sql
-- Description: Updates the resolve_study_query function to use cards_with_srs_stage 
--              for the includeDifficult flag, filtering for 'learning' stage.
--              Restores original deck_tags filtering logic.
--              Uses TEXT variables for date values.

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS resolve_study_query(jsonb, uuid);

-- Recreate the function with updated logic
CREATE OR REPLACE FUNCTION resolve_study_query(
    p_query_criteria jsonb,
    p_user_id uuid
    -- Assuming original function did not have p_order_by parameters, add if needed
    -- p_order_by_field TEXT DEFAULT 'created_at',
    -- p_order_by_direction TEXT DEFAULT 'DESC'
)
RETURNS TABLE(card_id uuid)
LANGUAGE plpgsql
STABLE 
SECURITY INVOKER 
AS $$
DECLARE
    v_sql                  TEXT;
    v_from_clause          TEXT := 'FROM cards c';
    v_join_clauses         TEXT := ''; -- For joins needed by filters
    v_where_clauses        TEXT[] := ARRAY[]::TEXT[];
    -- Use original's parameter approach if preferred, otherwise format() can work
    -- v_params               TEXT[] := ARRAY[]::TEXT[]; 
    -- v_param_index          INTEGER := 0;

    -- Parsed criteria variables
    v_deck_id              UUID;
    v_include_tags         UUID[];
    v_exclude_tags         UUID[];
    v_tag_logic            TEXT;
    v_srs_level_op         TEXT;
    v_srs_level_value      INT;
    v_include_difficult    BOOLEAN; -- Flag we are changing logic for
    
    -- Date related variables (using TEXT like corrected proposal)
    v_created_op           TEXT;
    v_created_value        TEXT; 
    v_updated_op           TEXT;
    v_updated_value        TEXT; 
    v_last_reviewed_op     TEXT;
    v_last_reviewed_value  TEXT; 
    v_next_due_op          TEXT;
    v_next_due_value       TEXT; 
    v_date_range_value     TEXT[]; -- Specific for 'betweenDates'

    -- Ordering variables (if needed, adapt from original)
    -- v_order_by_clause      TEXT;
    -- v_valid_order_field    TEXT;
    -- v_valid_order_direction TEXT;
    -- v_allowed_order_fields TEXT[] := ARRAY[...]; -- Use updated field names
    -- v_allowed_directions   TEXT[] := ARRAY['ASC','DESC'];

BEGIN
    -- Add mandatory user filter (using format %L for safety)
    v_where_clauses := array_append(v_where_clauses, format('c.user_id = %L', p_user_id));

    -- Extract criteria
    v_deck_id := p_query_criteria->>'deckId';
    v_tag_logic := COALESCE(p_query_criteria->>'tagLogic', 'ANY');
    v_include_difficult := (p_query_criteria->>'includeDifficult')::BOOLEAN;

    SELECT ARRAY(SELECT jsonb_array_elements_text(p_query_criteria->'includeTags')) INTO v_include_tags;
    SELECT ARRAY(SELECT jsonb_array_elements_text(p_query_criteria->'excludeTags')) INTO v_exclude_tags;
    v_include_tags := COALESCE(v_include_tags, ARRAY[]::UUID[]);
    v_exclude_tags := COALESCE(v_exclude_tags, ARRAY[]::UUID[]);

    -- --- Filter by Deck ---
    IF v_deck_id IS NOT NULL THEN
        v_where_clauses := array_append(v_where_clauses, format('c.deck_id = %L', v_deck_id));
    END IF;

    -- --- Filter by Tags (Restored Original Deck Tag Logic) ---
    -- Include Tags Logic
    IF array_length(v_include_tags, 1) > 0 THEN
        IF v_tag_logic = 'ALL' THEN
             -- Deck must have ALL the specified tags
             v_where_clauses := array_append(v_where_clauses, format(
                'c.deck_id IN (SELECT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]) GROUP BY dt.deck_id HAVING count(DISTINCT dt.tag_id) = %s)',
                p_user_id,
                v_include_tags, -- Embed UUID array directly with ::uuid[] cast
                array_length(v_include_tags,1)
             ));
        ELSE -- ANY (Default)
            -- Deck must have AT LEAST ONE of the specified tags
            v_where_clauses := array_append(v_where_clauses, format(
                'c.deck_id IN (SELECT DISTINCT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]))',
                p_user_id,
                v_include_tags -- Embed UUID array directly with ::uuid[] cast
            ));
        END IF;
    END IF;

    -- Exclude Tags Logic
    IF array_length(v_exclude_tags, 1) > 0 THEN
        -- Deck must NOT have ANY of the specified tags
        v_where_clauses := array_append(v_where_clauses, format(
            'c.deck_id NOT IN (SELECT DISTINCT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]))',
             p_user_id,
             v_exclude_tags -- Embed UUID array directly with ::uuid[] cast
        ));
    END IF;
    -- --- End Restored Tag Logic ---

    -- --- Filter by 'includeDifficult' flag (NEW LOGIC) ---
    IF v_include_difficult IS TRUE THEN
        -- Join with the view is required
        v_join_clauses := v_join_clauses || ' INNER JOIN cards_with_srs_stage cws ON c.id = cws.id';
        -- Add the condition to filter for 'learning' stage
        v_where_clauses := array_append(v_where_clauses, 'cws.srs_stage = ''learning''');
    END IF;
    -- --- End New Difficult Logic ---

    -- --- Filter by SRS Level (manual filter - simplified embedding) ---
    v_srs_level_op := p_query_criteria->'srsLevel'->>'operator';
    IF p_query_criteria->'srsLevel'->>'value' IS NOT NULL THEN
       v_srs_level_value := (p_query_criteria->'srsLevel'->>'value')::INT;
    ELSE
       v_srs_level_value := NULL;
    END IF;
    IF v_srs_level_op IS NOT NULL AND v_srs_level_value IS NOT NULL THEN
        CASE v_srs_level_op
            WHEN 'equals' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level = %s', v_srs_level_value));
            WHEN 'lessThan' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level < %s', v_srs_level_value));
            WHEN 'greaterThan' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level > %s', v_srs_level_value));
        END CASE;
    END IF;

    -- --- Date Filters (Using TEXT variables, requires full implementation) ---
    -- Example for 'createdDate' - Apply pattern to others
    v_created_op := p_query_criteria->'createdDate'->>'operator';
    IF v_created_op IS NOT NULL THEN
        v_created_value := p_query_criteria->'createdDate'->>'value'; 
        IF v_created_value IS NOT NULL THEN 
            IF v_created_op = 'newerThanDays' OR v_created_op = 'olderThanDays' THEN
                 v_where_clauses := array_append(v_where_clauses, format('c.created_at %s now() - interval %L', CASE v_created_op WHEN 'newerThanDays' THEN '>' ELSE '<' END, v_created_value || ' days'));
            ELSIF v_created_op = 'onDate' THEN
                 v_where_clauses := array_append(v_where_clauses, format('c.created_at::date = %L::date', v_created_value));
            -- >>> ADD 'betweenDates' logic here <<<
            END IF;
        -- >>> Handle operators without values ('never', 'isDue') here <<<
        END IF;
    END IF;
    -- >>> REPEAT for updatedDate, lastReviewed, nextReviewDue <<<

    -- --- Construct Final SQL ---
    v_sql := 'SELECT DISTINCT c.id ' || v_from_clause || ' ' || v_join_clauses;
    IF array_length(v_where_clauses, 1) > 0 THEN
        v_sql := v_sql || ' WHERE ' || array_to_string(v_where_clauses, ' AND ');
    END IF;

    -- Add Ordering (adapt from original if needed)
    -- v_sql := v_sql || ' ORDER BY c.created_at DESC NULLS LAST'; -- Example default

    RAISE LOG 'Executing SQL (v3): %', v_sql;

    -- Execute (using EXECUTE without USING as values are embedded via format)
    RETURN QUERY EXECUTE v_sql;

EXCEPTION WHEN others THEN
    RAISE LOG 'Error in resolve_study_query (v3): %', SQLERRM;
    RETURN QUERY SELECT uuid_nil(); 
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_study_query(jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION resolve_study_query(jsonb, uuid) IS 
'Resolves study query criteria JSON into a list of matching card IDs. v3: Uses cards_with_srs_stage for includeDifficult flag, keeps original deck_tags logic.';
