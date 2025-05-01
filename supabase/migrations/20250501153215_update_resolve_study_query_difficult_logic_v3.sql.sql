-- resolve_study_query function definition

CREATE OR REPLACE FUNCTION public.resolve_study_query(
    p_user_id uuid,
    p_query_criteria jsonb
)
RETURNS SETOF uuid -- Return a set of card IDs
LANGUAGE plpgsql
STABLE -- Function does not modify the database
SECURITY DEFINER -- Important for accessing tables with RLS based on p_user_id
AS $$
DECLARE
    v_sql                  TEXT;
    v_from_clause          TEXT := 'FROM cards c';
    v_join_clauses         TEXT := ''; -- For joins needed by filters
    v_where_clauses        TEXT[] := ARRAY[]::TEXT[];

    -- Parsed criteria variables
    v_deck_id              UUID;
    v_include_tags         UUID[];
    v_exclude_tags         UUID[];
    v_tag_logic            TEXT;
    v_srs_level_op         TEXT;
    v_srs_level_value      INT;
    v_include_difficult    BOOLEAN;

    -- Date related variables (using TEXT as in provided code)
    v_created_op           TEXT;
    v_created_value        TEXT;
    v_updated_op           TEXT;
    v_updated_value        TEXT;
    v_last_reviewed_op     TEXT;
    v_last_reviewed_value  TEXT;
    v_next_due_op          TEXT;
    v_next_due_value       TEXT;
    v_date_range_value     TEXT[]; -- Specific for 'betweenDates'
BEGIN
    -- Add mandatory user filter
    v_where_clauses := array_append(v_where_clauses, format('c.user_id = %L', p_user_id));

    -- Extract criteria
    v_deck_id := p_query_criteria->>'deckId';
    v_tag_logic := COALESCE(p_query_criteria->>'tagLogic', 'ANY');
    -- Ensure boolean conversion handles JSON null properly -> defaults to FALSE if null or not 'true'
    v_include_difficult := COALESCE((p_query_criteria->>'includeDifficult')::BOOLEAN, FALSE);

    -- Extract UUID arrays safely, checking for array type
    SELECT ARRAY(SELECT jsonb_array_elements_text(p_query_criteria->'includeTags') WHERE jsonb_typeof(p_query_criteria->'includeTags') = 'array') INTO v_include_tags;
    SELECT ARRAY(SELECT jsonb_array_elements_text(p_query_criteria->'excludeTags') WHERE jsonb_typeof(p_query_criteria->'excludeTags') = 'array') INTO v_exclude_tags;
    v_include_tags := COALESCE(v_include_tags, ARRAY[]::UUID[]);
    v_exclude_tags := COALESCE(v_exclude_tags, ARRAY[]::UUID[]);


    -- --- Filter by Deck ---
    IF v_deck_id IS NOT NULL THEN
        v_where_clauses := array_append(v_where_clauses, format('c.deck_id = %L', v_deck_id));
    END IF;

    -- --- Filter by Tags (Deck Tag Logic - Restored as per original) ---
    -- Assumes deck_tags table exists with deck_id, tag_id, user_id
    IF array_length(v_include_tags, 1) > 0 THEN
        IF v_tag_logic = 'ALL' THEN
             v_where_clauses := array_append(v_where_clauses, format(
                'c.deck_id IN (SELECT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]) GROUP BY dt.deck_id HAVING count(DISTINCT dt.tag_id) = %s)',
                p_user_id, v_include_tags, array_length(v_include_tags,1) ));
        ELSE -- ANY
            v_where_clauses := array_append(v_where_clauses, format(
                'c.deck_id IN (SELECT DISTINCT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]))',
                p_user_id, v_include_tags ));
        END IF;
    END IF;
    IF array_length(v_exclude_tags, 1) > 0 THEN
        v_where_clauses := array_append(v_where_clauses, format(
            'c.deck_id NOT IN (SELECT DISTINCT dt.deck_id FROM deck_tags dt WHERE dt.user_id = %L AND dt.tag_id = ANY(%L::uuid[]))',
             p_user_id, v_exclude_tags ));
    END IF;

    -- --- Filter by 'includeDifficult' flag (Uses cards_with_srs_stage) ---
    -- Keep this logic AS IS from the provided code.
    -- Assumes cards_with_srs_stage view exists and includes srs_stage='learning' for difficult cards.
    IF v_include_difficult IS TRUE THEN
        -- No need to join if already done for other filters, but simpler to just add it if flag is true
        -- Avoid duplicate joins if possible in more complex scenarios
        IF v_join_clauses NOT LIKE '%cards_with_srs_stage%' THEN
             v_join_clauses := v_join_clauses || ' INNER JOIN public.cards_with_srs_stage cws ON c.id = cws.id';
        END IF;
        -- This filter means srs_stage = 'learning' based on your current view/code.
        v_where_clauses := array_append(v_where_clauses, 'cws.srs_stage = ''learning''');
    END IF;

    -- --- Filter by SRS Level (manual filter) ---
    v_srs_level_op := p_query_criteria->'srsLevel'->>'operator';
    -- Check if the value field exists and is a valid number before casting
    IF p_query_criteria->'srsLevel'->>'value' IS NOT NULL AND p_query_criteria->'srsLevel'->>'value' ~ '^\d+$' THEN
       v_srs_level_value := (p_query_criteria->'srsLevel'->>'value')::INT;
    ELSE v_srs_level_value := NULL; END IF;

    IF v_srs_level_op IS NOT NULL AND v_srs_level_value IS NOT NULL THEN
        CASE v_srs_level_op
            WHEN 'equals' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level = %s', v_srs_level_value));
            WHEN 'lessThan' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level < %s', v_srs_level_value));
            WHEN 'greaterThan' THEN v_where_clauses := array_append(v_where_clauses, format('c.srs_level > %s', v_srs_level_value));
            -- Add default or error handling?
            ELSE -- Invalid operator
                 RAISE WARNING 'resolve_study_query: Invalid srsLevel operator: %', v_srs_level_op;
            -- Consider adding a WHERE 1=0 clause here if invalid operator should return no results
        END CASE;
    END IF;

    -- --- Date Filters (COMPLETE THE LOGIC FOR ALL 4 FIELDS) ---
    -- Filter by createdDate
    v_created_op := p_query_criteria->'createdDate'->>'operator';
    IF v_created_op IS NOT NULL THEN
        -- Value for createdDate can be number of days (string) or date string
        v_created_value := p_query_criteria->'createdDate'->>'value';
        -- Value for betweenDates is always an array
        SELECT ARRAY(SELECT jsonb_array_elements_text(p_query_criteria->'createdDate'->'value') WHERE jsonb_typeof(p_query_criteria->'createdDate'->'value') = 'array') INTO v_date_range_value;

        CASE v_created_op
            WHEN 'newerThanDays' OR 'olderThanDays' THEN
                 IF v_created_value IS NOT NULL AND v_created_value ~ '^\d+$' THEN -- Check if value is number of days
                    v_where_clauses := array_append(v_where_clauses, format('c.created_at %s now() - interval %L', CASE v_created_op WHEN 'newerThanDays' THEN '>=' ELSE '<=' END, v_created_value || ' days'));
                 END IF;
            WHEN 'onDate' THEN
                 IF v_created_value IS NOT NULL THEN -- Check if value is a date string
                    -- Use date comparison to ignore time part
                    v_where_clauses := array_append(v_where_clauses, format('c.created_at::date = %L::date', v_created_value));
                 END IF;
            WHEN 'betweenDates' THEN
                 IF array_length(v_date_range_value, 1) = 2 AND v_date_range_value[1] IS NOT NULL AND v_date_range_value[2] IS NOT NULL THEN
                      -- Include both start and end date by comparing dates
                      v_where_clauses := array_append(v_where_clauses, format('c.created_at::date >= %L::date', v_date_range_value[1]));
                      v_where_clauses := array_append(v_where_clauses, format('c.created_at::date <= %L::date', v_date_range_value[2]));
                 END IF;
             ELSE -- Invalid operator
                  RAISE WARNING 'resolve_study_query: Invalid createdDate operator: %', v_created_op;
             -- Consider adding a WHERE 1=0 clause here
        END CASE;
    END IF;

    -- Filter by updatedDate
     v_updated_op := p_query_criteria->'updatedDate'->>'operator';
    IF v_updated_op IS NOT NULL THEN
        v_updated_value := p_query_criteria->'updatedDate'->>'value';
        SELECT ARRAY(SELECT jsonb_array_elements_text(p_query_criteria->'updatedDate'->'value') WHERE jsonb_typeof(p_query_criteria->'updatedDate'->'value') = 'array') INTO v_date_range_value;

        CASE v_updated_op
             WHEN 'newerThanDays' OR 'olderThanDays' THEN
                 IF v_updated_value IS NOT NULL AND v_updated_value ~ '^\d+$' THEN
                     v_where_clauses := array_append(v_where_clauses, format('c.updated_at %s now() - interval %L', CASE v_updated_op WHEN 'newerThanDays' THEN '>=' ELSE '<=' END, v_updated_value || ' days'));
                 END IF;
             WHEN 'onDate' THEN
                 IF v_updated_value IS NOT NULL THEN
                     v_where_clauses := array_append(v_where_clauses, format('c.updated_at::date = %L::date', v_updated_value));
                 END IF;
             WHEN 'betweenDates' THEN
                 IF array_length(v_date_range_value, 1) = 2 AND v_date_range_value[1] IS NOT NULL AND v_date_range_value[2] IS NOT NULL THEN
                      v_where_clauses := array_append(v_where_clauses, format('c.updated_at::date >= %L::date', v_date_range_value[1]));
                      v_where_clauses := array_append(v_where_clauses, format('c.updated_at::date <= %L::date', v_date_range_value[2]));
                 END IF;
             ELSE -- Invalid operator
                  RAISE WARNING 'resolve_study_query: Invalid updatedDate operator: %', v_updated_op;
        END CASE;
    END IF;

    -- Filter by lastReviewed
     v_last_reviewed_op := p_query_criteria->'lastReviewed'->>'operator';
    IF v_last_reviewed_op IS NOT NULL THEN
        v_last_reviewed_value := p_query_criteria->'lastReviewed'->>'value';
        SELECT ARRAY(SELECT jsonb_array_elements_text(p_query_criteria->'lastReviewed'->'value') WHERE jsonb_typeof(p_query_criteria->'lastReviewed'->'value') = 'array') INTO v_date_range_value;

        CASE v_last_reviewed_op
             WHEN 'newerThanDays' OR 'olderThanDays' THEN
                 IF v_last_reviewed_value IS NOT NULL AND v_last_reviewed_value ~ '^\d+$' THEN
                     -- Apply IS NOT NULL check for reviewed dates
                     v_where_clauses := array_append(v_where_clauses, format('c.last_reviewed_at IS NOT NULL AND c.last_reviewed_at %s now() - interval %L', CASE v_last_reviewed_op WHEN 'newerThanDays' THEN '>=' ELSE '<=' END, v_last_reviewed_value || ' days'));
                 END IF;
             WHEN 'onDate' THEN
                 IF v_last_reviewed_value IS NOT NULL THEN
                      v_where_clauses := array_append(v_where_clauses, format('c.last_reviewed_at IS NOT NULL AND c.last_reviewed_at::date = %L::date', v_last_reviewed_value));
                 END IF;
             WHEN 'betweenDates' THEN
                 IF array_length(v_date_range_value, 1) = 2 AND v_date_range_value[1] IS NOT NULL AND v_date_range_value[2] IS NOT NULL THEN
                      v_where_clauses := array_append(v_where_clauses, format('c.last_reviewed_at IS NOT NULL AND c.last_reviewed_at::date >= %L::date', v_date_range_value[1]));
                      v_where_clauses := array_append(v_where_clauses, format('c.last_reviewed_at::date <= %L::date', v_date_range_value[2]));
                 END IF;
             WHEN 'never' THEN
                 v_where_clauses := array_append(v_where_clauses, 'c.last_reviewed_at IS NULL');
             ELSE -- Invalid operator
                  RAISE WARNING 'resolve_study_query: Invalid lastReviewed operator: %', v_last_reviewed_op;
        END CASE;
    END IF;

    -- Filter by nextReviewDue
     v_next_due_op := p_query_criteria->'nextReviewDue'->>'operator';
    IF v_next_due_op IS NOT NULL THEN
        v_next_due_value := p_query_criteria->'nextReviewDue'->>'value';
        SELECT ARRAY(SELECT jsonb_array_elements_text(p_query_criteria->'nextReviewDue'->'value') WHERE jsonb_typeof(p_query_criteria->'nextReviewDue'->'value') = 'array') INTO v_date_range_value;

        CASE v_next_due_op
            WHEN 'newerThanDays' OR 'olderThanDays' THEN
                -- Note: 'newerThanDays' for next_review_due means FURTHER in the future (>= now() - interval)
                -- Note: 'olderThanDays' for next_review_due means CLOSER to now (or past) (<= now() - interval)
                 IF v_next_due_value IS NOT NULL AND v_next_due_value ~ '^\d+$' THEN
                     v_where_clauses := array_append(v_where_clauses, format('c.next_review_due IS NOT NULL AND c.next_review_due %s now() - interval %L', CASE v_next_due_op WHEN 'newerThanDays' THEN '>=' ELSE '<=' END, v_next_due_value || ' days')); -- Fixed operators here
                 END IF;
            WHEN 'onDate' THEN
                 IF v_next_due_value IS NOT NULL THEN
                     v_where_clauses := array_append(v_where_clauses, format('c.next_review_due IS NOT NULL AND c.next_review_due::date = %L::date', v_next_due_value));
                 END IF;
            WHEN 'betweenDates' THEN
                 IF array_length(v_date_range_value, 1) = 2 AND v_date_range_value[1] IS NOT NULL AND v_date_range_value[2] IS NOT NULL THEN
                      v_where_clauses := array_append(v_where_clauses, format('c.next_review_due IS NOT NULL AND c.next_review_due::date >= %L::date', v_date_range_value[1]));
                      v_where_clauses := array_append(v_where_clauses, format('c.next_review_due::date <= %L::date', v_date_range_value[2]));
                 END IF;
            WHEN 'never' THEN
                 v_where_clauses := array_append(v_where_clauses, 'c.next_review_due IS NULL');
            WHEN 'isDue' THEN
                 -- Cards are due if next_review_due is NULL (never scheduled) OR in the past/present.
                 v_where_clauses := array_append(v_where_clauses, '(c.next_review_due IS NULL OR c.next_review_due <= NOW())');
            ELSE -- Invalid operator
                 RAISE WARNING 'resolve_study_query: Invalid nextReviewDue operator: %', v_next_due_op;
        END CASE;
    END IF;


    -- --- Construct Final SQL ---
    v_sql := 'SELECT DISTINCT c.id ' || v_from_clause || ' ' || v_join_clauses;
    IF array_length(v_where_clauses, 1) > 0 THEN
        v_sql := v_sql || ' WHERE ' || array_to_string(v_where_clauses, ' AND ');
    END IF;

    RAISE LOG '[resolve_study_query] User: %, Criteria: %, SQL: %', p_user_id, p_query_criteria, v_sql;

    RETURN QUERY EXECUTE v_sql;

EXCEPTION WHEN others THEN
    -- Log the error and return empty set on error
    RAISE WARNING '[resolve_study_query] Error building or executing query for User: %, Criteria: %. Error: %', p_user_id, p_query_criteria, SQLERRM;
    RETURN; -- Returns empty table
END;
$$;

COMMENT ON FUNCTION public.resolve_study_query(uuid, jsonb) IS
'Resolves study query criteria JSON into a list of matching card IDs. v6: Uses deck_tags for tag filtering, maps `includeDifficult` to ''learning'' stage, completes all date filter logic.';