-- Drop the previous function signature (if it used only 2 arguments)
DROP FUNCTION IF EXISTS resolve_study_query(uuid, jsonb);
-- Drop the function signature this migration creates (if it exists from a previous failed attempt)
DROP FUNCTION IF EXISTS resolve_study_query(uuid, jsonb, text, text);

-- Create the function with the corrected definition
CREATE OR REPLACE FUNCTION resolve_study_query(
    p_user_id uuid,
    p_query_criteria jsonb,
    p_order_by_field text DEFAULT 'created_at',
    p_order_by_direction text DEFAULT 'DESC'
)
RETURNS TABLE(card_id uuid)
LANGUAGE plpgsql
STABLE       -- Can read data, doesn't modify
SECURITY INVOKER -- Runs with the privileges of the calling user (respects RLS)
AS $$
DECLARE
    v_sql text;
    v_from_clause TEXT := 'FROM cards c'; -- Start FROM clause
    v_where_clauses text[] := ARRAY[]::text[];
    -- Use text[] to hold string representations of parameters
    v_params text[] := ARRAY[]::text[];
    v_param_index integer := 0; -- Start index at 0, will increment before first use

    -- Parsed criteria variables
    v_deck_id uuid;
    v_all_cards boolean;
    v_include_tags uuid[];
    v_exclude_tags uuid[];
    v_tag_logic text;
    v_deck_title_contains text;
    v_deck_languages_raw jsonb;
    v_deck_languages text[];
    v_created_date_filter jsonb;
    v_updated_date_filter jsonb;
    v_last_reviewed_filter jsonb;
    v_next_review_due_filter jsonb;
    v_srs_level_filter jsonb;

    v_date_operator text;
    v_date_value_days integer;
    v_date_value_start text;
    v_date_value_end text;
    v_srs_operator text;
    v_srs_value integer;

    -- Ordering variables
    v_order_by_clause text;
    v_valid_order_field text;
    v_valid_order_direction text;
    v_allowed_order_fields text[] := ARRAY['created_at', 'updated_at', 'front_content', 'back_content', 'last_reviewed_at', 'next_review_due', 'srs_level', 'easiness_factor', 'interval_days', 'stability', 'difficulty'];
    v_allowed_directions text[] := ARRAY['ASC', 'DESC'];
BEGIN
    -- 0. Increment counter and add mandatory user_id parameter/clause
    v_param_index := v_param_index + 1;
    v_where_clauses := array_append(v_where_clauses, format('c.user_id = $%s::uuid', v_param_index));
    v_params := array_append(v_params, p_user_id::text);

    -- 1. Handle "allCards" flag
    v_all_cards := (p_query_criteria ->> 'allCards')::boolean;
    IF v_all_cards IS TRUE THEN
        -- Skip other filters if allCards is explicitly true
        NULL;
    ELSE
        -- 2. Deck Filter
        v_deck_id := (p_query_criteria ->> 'deckId')::uuid;
        IF v_deck_id IS NOT NULL THEN
            v_param_index := v_param_index + 1;
            v_where_clauses := array_append(v_where_clauses, format('c.deck_id = $%s::uuid', v_param_index));
            v_params := array_append(v_params, v_deck_id::text);
        END IF;

        -- 3. Deck Title / Language Filters (Requires JOIN)
        v_deck_title_contains := p_query_criteria ->> 'deckTitleContains';
        v_deck_languages_raw := p_query_criteria -> 'deckLanguages';

        IF v_deck_title_contains IS NOT NULL OR (v_deck_languages_raw IS NOT NULL AND jsonb_typeof(v_deck_languages_raw) = 'array' AND jsonb_array_length(v_deck_languages_raw) > 0) THEN
            v_from_clause := v_from_clause || ' JOIN decks d ON c.deck_id = d.id';

            IF v_deck_title_contains IS NOT NULL THEN
                 v_param_index := v_param_index + 1;
                 v_where_clauses := array_append(v_where_clauses, format('d.title ILIKE $%s', v_param_index));
                 v_params := array_append(v_params, ('%' || v_deck_title_contains || '%')::text);
            END IF;

            IF v_deck_languages_raw IS NOT NULL AND jsonb_typeof(v_deck_languages_raw) = 'array' AND jsonb_array_length(v_deck_languages_raw) > 0 THEN
                SELECT array_agg(elem::text) INTO v_deck_languages FROM jsonb_array_elements_text(v_deck_languages_raw) AS elem;
                v_param_index := v_param_index + 1;
                v_where_clauses := array_append(v_where_clauses, format('(d.primary_language = ANY($%s::text[]) OR d.secondary_language = ANY($%s::text[]))', v_param_index, v_param_index));
                v_params := array_append(v_params, v_deck_languages::text);
            END IF;
        END IF;

        -- 4. Tag Filtering
        v_tag_logic := COALESCE(p_query_criteria ->> 'tagLogic', 'ANY');

        IF (p_query_criteria -> 'includeTags') IS NOT NULL AND jsonb_typeof(p_query_criteria -> 'includeTags') = 'array' AND jsonb_array_length(p_query_criteria -> 'includeTags') > 0 THEN
            SELECT array_agg(elem::text::uuid) INTO v_include_tags FROM jsonb_array_elements_text(p_query_criteria -> 'includeTags') AS elem;
            v_param_index := v_param_index + 1;
            IF v_tag_logic = 'ALL' THEN
                v_where_clauses := array_append(v_where_clauses, format(
                    '(SELECT count(DISTINCT ct.tag_id) FROM card_tags ct WHERE ct.card_id = c.id AND ct.user_id = $1::uuid AND ct.tag_id = ANY($%s::uuid[])) = %s',
                    v_param_index, array_length(v_include_tags, 1)
                ));
            ELSE -- ANY
                v_where_clauses := array_append(v_where_clauses, format(
                    'EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = c.id AND ct.user_id = $1::uuid AND ct.tag_id = ANY($%s::uuid[]))',
                    v_param_index
                ));
            END IF;
            v_params := array_append(v_params, v_include_tags::text);
        END IF;

        IF (p_query_criteria -> 'excludeTags') IS NOT NULL AND jsonb_typeof(p_query_criteria -> 'excludeTags') = 'array' AND jsonb_array_length(p_query_criteria -> 'excludeTags') > 0 THEN
            SELECT array_agg(elem::text::uuid) INTO v_exclude_tags FROM jsonb_array_elements_text(p_query_criteria -> 'excludeTags') AS elem;
            v_param_index := v_param_index + 1;
            v_where_clauses := array_append(v_where_clauses, format(
                'NOT EXISTS (SELECT 1 FROM card_tags ct WHERE ct.card_id = c.id AND ct.user_id = $1::uuid AND ct.tag_id = ANY($%s::uuid[]))',
                v_param_index
            ));
            v_params := array_append(v_params, v_exclude_tags::text);
        END IF;

        -- 5. Date/Timestamp Filters
        v_created_date_filter := p_query_criteria -> 'createdDate';
        v_updated_date_filter := p_query_criteria -> 'updatedDate';
        v_last_reviewed_filter := p_query_criteria -> 'lastReviewed';
        v_next_review_due_filter := p_query_criteria -> 'nextReviewDue';

        -- Helper function or loop could abstract this, but explicit for clarity:
        -- Created Date
        IF v_created_date_filter IS NOT NULL AND jsonb_typeof(v_created_date_filter) = 'object' THEN
            v_date_operator := v_created_date_filter ->> 'operator';
            IF v_date_operator = 'newerThanDays' AND jsonb_typeof(v_created_date_filter->'value') = 'number' THEN
                v_date_value_days := (v_created_date_filter->>'value')::integer;
                v_param_index := v_param_index + 1;
                v_where_clauses := array_append(v_where_clauses, format('c.created_at >= (NOW() - ($%s::integer * interval ''1 day''))', v_param_index));
                v_params := array_append(v_params, v_date_value_days::text);
            ELSIF v_date_operator = 'olderThanDays' AND jsonb_typeof(v_created_date_filter->'value') = 'number' THEN
                v_date_value_days := (v_created_date_filter->>'value')::integer;
                v_param_index := v_param_index + 1;
                v_where_clauses := array_append(v_where_clauses, format('c.created_at < (NOW() - ($%s::integer * interval ''1 day''))', v_param_index));
                v_params := array_append(v_params, v_date_value_days::text);
            ELSIF v_date_operator = 'onDate' AND jsonb_typeof(v_created_date_filter->'value') = 'string' THEN
                v_date_value_start := v_created_date_filter->>'value'; -- Should be 'YYYY-MM-DD'
                v_param_index := v_param_index + 1;
                v_where_clauses := array_append(v_where_clauses, format('c.created_at::date = $%s::date', v_param_index));
                v_params := array_append(v_params, v_date_value_start);
            ELSIF v_date_operator = 'betweenDates' AND jsonb_typeof(v_created_date_filter -> 'value') = 'array' AND jsonb_array_length(v_created_date_filter -> 'value') = 2 THEN
                 v_date_value_start := v_created_date_filter -> 'value' ->> 0;
                 v_date_value_end   := v_created_date_filter -> 'value' ->> 1;
                 IF v_date_value_start IS NOT NULL AND v_date_value_end IS NOT NULL THEN
                     v_param_index := v_param_index + 1;
                     v_where_clauses := array_append(v_where_clauses, format('c.created_at >= $%s::timestamptz', v_param_index));
                     v_params := array_append(v_params, v_date_value_start);
                     v_param_index := v_param_index + 1;
                     v_where_clauses := array_append(v_where_clauses, format('c.created_at <= $%s::timestamptz', v_param_index));
                     v_params := array_append(v_params, v_date_value_end);
                 END IF;
            END IF;
        END IF;

        -- Updated Date (Similar logic as createdDate)
        IF v_updated_date_filter IS NOT NULL AND jsonb_typeof(v_updated_date_filter) = 'object' THEN
           -- ... Implement similar operator checks for 'c.updated_at' ...
        END IF;

        -- Last Reviewed Date
        IF v_last_reviewed_filter IS NOT NULL AND jsonb_typeof(v_last_reviewed_filter) = 'object' THEN
            v_date_operator := v_last_reviewed_filter ->> 'operator';
            IF v_date_operator = 'newerThanDays' AND jsonb_typeof(v_last_reviewed_filter->'value') = 'number' THEN
                v_date_value_days := (v_last_reviewed_filter->>'value')::integer;
                v_param_index := v_param_index + 1;
                v_where_clauses := array_append(v_where_clauses, format('c.last_reviewed_at >= (NOW() - ($%s::integer * interval ''1 day''))', v_param_index));
                v_params := array_append(v_params, v_date_value_days::text);
            ELSIF v_date_operator = 'olderThanDays' AND jsonb_typeof(v_last_reviewed_filter->'value') = 'number' THEN
                 v_date_value_days := (v_last_reviewed_filter->>'value')::integer;
                 v_param_index := v_param_index + 1;
                 v_where_clauses := array_append(v_where_clauses, format('c.last_reviewed_at < (NOW() - ($%s::integer * interval ''1 day''))', v_param_index));
                 v_params := array_append(v_params, v_date_value_days::text);
            ELSIF v_date_operator = 'never' THEN
                 v_where_clauses := array_append(v_where_clauses, 'c.last_reviewed_at IS NULL');
            -- Add onDate, betweenDates if needed for last_reviewed_at
            END IF;
        END IF;

        -- Next Review Due Date (Similar logic)
        IF v_next_review_due_filter IS NOT NULL AND jsonb_typeof(v_next_review_due_filter) = 'object' THEN
            v_date_operator := v_next_review_due_filter ->> 'operator';
            -- Example: Operator 'isDue' (maps to <= now)
            IF v_date_operator = 'isDue' THEN
                 v_where_clauses := array_append(v_where_clauses, 'c.next_review_due <= NOW()');
            -- Implement other operators like newerThanDays, olderThanDays, onDate, betweenDates for next_review_due
            END IF;
        END IF;

        -- 6. SRS Level Filter
        v_srs_level_filter := p_query_criteria -> 'srsLevel';
        IF v_srs_level_filter IS NOT NULL AND jsonb_typeof(v_srs_level_filter) = 'object' THEN
            v_srs_operator := v_srs_level_filter ->> 'operator';
            v_srs_value    := (v_srs_level_filter ->> 'value')::integer;
            IF v_srs_value IS NOT NULL THEN
                v_param_index := v_param_index + 1;
                IF v_srs_operator = 'equals' THEN
                    v_where_clauses := array_append(v_where_clauses, format('c.srs_level = $%s::integer', v_param_index));
                ELSIF v_srs_operator = 'lessThan' THEN
                    v_where_clauses := array_append(v_where_clauses, format('c.srs_level < $%s::integer', v_param_index));
                ELSIF v_srs_operator = 'greaterThan' THEN
                    v_where_clauses := array_append(v_where_clauses, format('c.srs_level > $%s::integer', v_param_index));
                END IF;
                v_params := array_append(v_params, v_srs_value::text);
            END IF;
        END IF;

        -- TODO: Add filters for other SRS properties (easiness_factor, interval_days, etc.) if needed

    END IF; -- End of IF !allCards

    -- 7. Construct Ordering
    v_valid_order_field := p_order_by_field;
    v_valid_order_direction := upper(p_order_by_direction);

    IF NOT (v_valid_order_field = ANY(v_allowed_order_fields)) THEN
        v_valid_order_field := 'created_at'; -- Default field on invalid input
    END IF;
    IF NOT (v_valid_order_direction = ANY(v_allowed_directions)) THEN
        v_valid_order_direction := 'DESC'; -- Default direction on invalid input
    END IF;

    -- Use format with %I for identifier and %s for validated direction
    v_order_by_clause := format('ORDER BY c.%I %s NULLS LAST', v_valid_order_field, v_valid_order_direction); -- Added NULLS LAST for date fields


    -- 8. Construct Final SQL Query
    v_sql := 'SELECT c.id ' || v_from_clause || ' WHERE ' || array_to_string(v_where_clauses, ' AND ') || ' ' || v_order_by_clause;

    -- For Debugging:
    -- RAISE NOTICE 'SQL: %', v_sql;
    -- RAISE NOTICE 'PARAMS: %', v_params;

    -- 9. Execute and Return Results
    RETURN QUERY EXECUTE v_sql USING v_params;

EXCEPTION
    WHEN others THEN
        -- Log error or handle specific exceptions
        RAISE WARNING 'Error in resolve_study_query for user %: %', p_user_id, SQLERRM;
        -- Return empty set on error
        RETURN;

END;
$$;