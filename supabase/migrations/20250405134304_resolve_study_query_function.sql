-- Drop the old function signature if it exists, matching arguments
DROP FUNCTION IF EXISTS resolve_study_query(uuid, jsonb);

-- Create the function with the new definition
CREATE OR REPLACE FUNCTION resolve_study_query(
    p_user_id uuid,
    p_query_criteria jsonb
)
RETURNS TABLE(card_id uuid)
LANGUAGE plpgsql
STABLE -- Indicates the function cannot modify the database and returns same results for same args within a transaction
AS $$
DECLARE
    v_sql TEXT;
    v_from_clause TEXT := 'FROM cards c'; -- Start FROM clause
    v_where_clauses TEXT[] := ARRAY['c.user_id = $1']; -- Mandatory user_id filter
    -- Use text[] to hold string representations of parameters
    v_params text[] := ARRAY[p_user_id::text]; -- Cast initial parameter to text
    v_param_counter INTEGER := 1; -- Start param index at 1 ($1 is user_id)

    -- Parsed criteria variables
    v_deck_id uuid;
    v_all_cards boolean;
    v_include_tags uuid[];
    v_exclude_tags uuid[];
    v_tag_logic TEXT;
    v_deck_title_contains TEXT;
    v_deck_languages_raw jsonb;
    v_deck_languages TEXT[];
    v_created_date_filter jsonb;
    v_created_date_operator TEXT;
    v_date_value_days INTEGER;
    -- Placeholder for date range if implemented with parameters
    -- v_date_value_start TIMESTAMPTZ;
    -- v_date_value_end TIMESTAMPTZ;

    v_order_by_field TEXT := 'c.created_at'; -- Default order field
    v_order_by_direction TEXT := 'DESC';      -- Default order direction
    v_order_by_clause TEXT;
BEGIN
    -- Parameter 1 is p_user_id

    -- Parse JSON criteria
    v_all_cards := (p_query_criteria ->> 'allCards')::boolean;
    IF v_all_cards IS TRUE THEN
        -- If allCards is true, ignore most other filters
        v_sql := 'SELECT c.id FROM cards c WHERE c.user_id = $1 ORDER BY c.created_at DESC'; -- Use default order
        RETURN QUERY EXECUTE v_sql USING p_user_id;
        RETURN; -- Exit function
    END IF;

    v_deck_id := (p_query_criteria ->> 'deckId')::uuid;
    v_deck_title_contains := p_query_criteria ->> 'deckTitleContains';
    v_deck_languages_raw := p_query_criteria -> 'deckLanguages';
    v_created_date_filter := p_query_criteria -> 'createdDate';

    -- Conditionally build FROM/JOIN clause
    IF v_deck_title_contains IS NOT NULL OR v_deck_languages_raw IS NOT NULL THEN
        v_from_clause := v_from_clause || ' JOIN decks d ON c.deck_id = d.id';
    END IF;
    -- Note: If filtering by tags, joining card_tags might be needed depending on approach (EXISTS vs JOIN)

    -- Conditionally build WHERE clauses and add parameters
    IF v_deck_id IS NOT NULL THEN
        v_param_counter := v_param_counter + 1;
        -- Deck ID needs explicit cast in WHERE clause if param is text
        v_where_clauses := array_append(v_where_clauses, format('c.deck_id = $%s::uuid', v_param_counter));
        v_params := array_append(v_params, v_deck_id::text);
    END IF;

    IF v_deck_title_contains IS NOT NULL THEN
        v_param_counter := v_param_counter + 1;
        v_where_clauses := array_append(v_where_clauses, format('d.title ILIKE $%s', v_param_counter));
        v_params := array_append(v_params, ('%' || v_deck_title_contains || '%')::text);
    END IF;

    -- Deck Languages (Example)
    IF v_deck_languages_raw IS NOT NULL AND jsonb_typeof(v_deck_languages_raw) = 'array' AND jsonb_array_length(v_deck_languages_raw) > 0 THEN
       SELECT array_agg(elem::text) INTO v_deck_languages FROM jsonb_array_elements_text(v_deck_languages_raw) AS elem;
       v_param_counter := v_param_counter + 1;
       -- Use explicit cast to text[] within the SQL string for the ANY operator
       v_where_clauses := array_append(v_where_clauses, format('(d.primary_language = ANY($%s::text[]) OR d.secondary_language = ANY($%s::text[]))', v_param_counter, v_param_counter));
       -- Pass the text array variable directly to USING, cast to text representation for the v_params array
       v_params := array_append(v_params, v_deck_languages::text);
    END IF;

    -- Tag Filtering
    v_tag_logic := COALESCE(p_query_criteria ->> 'tagLogic', 'ANY'); -- Default to 'ANY'

    IF (p_query_criteria -> 'includeTags') IS NOT NULL AND jsonb_typeof(p_query_criteria -> 'includeTags') = 'array' AND jsonb_array_length(p_query_criteria -> 'includeTags') > 0 THEN
        SELECT array_agg(elem::text::uuid) INTO v_include_tags FROM jsonb_array_elements_text(p_query_criteria -> 'includeTags') AS elem;
        v_param_counter := v_param_counter + 1; -- Increment counter for the tag array param
        IF v_tag_logic = 'ALL' THEN
             v_where_clauses := array_append(v_where_clauses, format(
                -- Added explicit cast ::uuid[] for the ANY operator
                'EXISTS (SELECT 1 FROM card_tags ct_incl WHERE ct_incl.card_id = c.id AND ct_incl.user_id = $1 AND ct_incl.tag_id = ANY($%s::uuid[]) GROUP BY ct_incl.card_id HAVING COUNT(DISTINCT ct_incl.tag_id) = %s)',
                v_param_counter, array_length(v_include_tags)
            ));
        ELSE -- ANY
            v_where_clauses := array_append(v_where_clauses, format(
                -- Added explicit cast ::uuid[] for the ANY operator
                'EXISTS (SELECT 1 FROM card_tags ct_incl WHERE ct_incl.card_id = c.id AND ct_incl.user_id = $1 AND ct_incl.tag_id = ANY($%s::uuid[]))',
                v_param_counter
            ));
        END IF;
        -- Cast the uuid array to its text representation for the v_params text[]
        v_params := array_append(v_params, v_include_tags::text);
    END IF;

     IF (p_query_criteria -> 'excludeTags') IS NOT NULL AND jsonb_typeof(p_query_criteria -> 'excludeTags') = 'array' AND jsonb_array_length(p_query_criteria -> 'excludeTags') > 0 THEN
        SELECT array_agg(elem::text::uuid) INTO v_exclude_tags FROM jsonb_array_elements_text(p_query_criteria -> 'excludeTags') AS elem;
        v_param_counter := v_param_counter + 1; -- Increment counter
        v_where_clauses := array_append(v_where_clauses, format(
            -- Added explicit cast ::uuid[] for the ANY operator
            'NOT EXISTS (SELECT 1 FROM card_tags ct_excl WHERE ct_excl.card_id = c.id AND ct_excl.user_id = $1 AND ct_excl.tag_id = ANY($%s::uuid[]))',
            v_param_counter
        ));
        -- Cast the uuid array to its text representation for the v_params text[]
        v_params := array_append(v_params, v_exclude_tags::text);
     END IF;

    -- Created Date Filtering
    IF v_created_date_filter IS NOT NULL AND jsonb_typeof(v_created_date_filter) = 'object' THEN
        v_created_date_operator := v_created_date_filter ->> 'operator';
        IF v_created_date_operator = 'newerThanDays' THEN
            v_date_value_days := (v_created_date_filter ->> 'value')::integer;
            IF v_date_value_days IS NOT NULL THEN
                 v_param_counter := v_param_counter + 1;
                 -- Parameterize the interval value
                 v_where_clauses := array_append(v_where_clauses, format('c.created_at >= (NOW() - ($%s * interval ''1 day''))', v_param_counter));
                 v_params := array_append(v_params, v_date_value_days::text);
            END IF;
        ELSIF v_created_date_operator = 'olderThanDays' THEN
             v_date_value_days := (v_created_date_filter ->> 'value')::integer;
             IF v_date_value_days IS NOT NULL THEN
                 v_param_counter := v_param_counter + 1;
                 -- Parameterize the interval value
                 v_where_clauses := array_append(v_where_clauses, format('c.created_at < (NOW() - ($%s * interval ''1 day''))', v_param_counter));
                 v_params := array_append(v_params, v_date_value_days::text);
             END IF;
        -- TODO: Implement 'betweenDates' using two parameters if needed
        /*
        ELSIF v_created_date_operator = 'betweenDates' THEN
            IF jsonb_typeof(v_created_date_filter -> 'value') = 'array' AND jsonb_array_length(v_created_date_filter -> 'value') = 2 THEN
                 -- Extract start and end dates
                 v_date_value_start := (v_created_date_filter -> 'value' ->> 0)::timestamptz;
                 v_date_value_end   := (v_created_date_filter -> 'value' ->> 1)::timestamptz;
                 IF v_date_value_start IS NOT NULL AND v_date_value_end IS NOT NULL THEN
                     v_param_counter := v_param_counter + 1;
                     v_where_clauses := array_append(v_where_clauses, format('c.created_at >= $%s::timestamptz', v_param_counter));
                     v_params := array_append(v_params, v_date_value_start::text);

                     v_param_counter := v_param_counter + 1;
                     v_where_clauses := array_append(v_where_clauses, format('c.created_at <= $%s::timestamptz', v_param_counter));
                     v_params := array_append(v_params, v_date_value_end::text);
                 END IF;
            END IF;
        */
        END IF;
    END IF;


    -- Order By Clause
    IF p_query_criteria -> 'orderBy' IS NOT NULL THEN
        v_order_by_field := p_query_criteria -> 'orderBy' ->> 'field';
        v_order_by_direction := p_query_criteria -> 'orderBy' ->> 'direction';
        -- Validate field and direction to prevent SQL injection
        -- Extend allowlist as needed (e.g., 'updated_at', 'srs_level', 'next_review_due')
        IF v_order_by_field IN ('created_at', 'updated_at') AND upper(v_order_by_direction) IN ('ASC', 'DESC') THEN
           -- Use quote_ident for the field name if it comes from user input indirectly
           -- Use 'c.' prefix assuming ordering is on cards table for now
           v_order_by_clause := format('ORDER BY c.%I %s', v_order_by_field, upper(v_order_by_direction));
        ELSE
            -- Invalid or unsafe order parameters, use default
           v_order_by_clause := 'ORDER BY c.created_at DESC';
        END IF;
    ELSE
        -- Default order
        v_order_by_clause := 'ORDER BY c.created_at DESC';
    END IF;


    -- Construct the final SQL query
    v_sql := 'SELECT c.id ' || v_from_clause || ' WHERE ' || array_to_string(v_where_clauses, ' AND ') || ' ' || v_order_by_clause;

    -- RAISE NOTICE 'SQL: %', v_sql; -- For debugging SQL string
    -- RAISE NOTICE 'PARAMS: %', v_params; -- For debugging parameters

    -- Execute the dynamic query with the dynamically built text parameter list
    -- No need for 'variadic' when passing a single text[] array to USING
    RETURN QUERY EXECUTE v_sql USING v_params;

EXCEPTION
    WHEN others THEN
        -- Log error or handle specific exceptions (e.g., invalid JSON)
        RAISE WARNING 'Error in resolve_study_query for user %: %', p_user_id, SQLERRM;
        -- Return empty set on error
        RETURN;

END;
$$;