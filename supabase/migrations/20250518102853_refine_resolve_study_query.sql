CREATE OR REPLACE FUNCTION public.resolve_study_query(
    p_user_id uuid,
    p_input_criteria jsonb DEFAULT NULL, -- Criteria directly provided (this is the original p_query_criteria)
    p_study_set_id uuid DEFAULT NULL,   -- ID of a study set to get criteria from (NEW PARAMETER)
    p_random_seed REAL DEFAULT NULL     -- Seed for random ordering (NEW PARAMETER, original v10 fixed ordering is kept)
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_query_criteria JSONB; -- Will hold the criteria from either input or study_set (NEW)

    -- Original v10 variable declarations from user paste:
    v_sql                  TEXT;
    v_from_clause          TEXT := 'FROM public.cards c';
    v_join_clauses         TEXT := '';
    v_where_clauses        TEXT[] := ARRAY[]::TEXT[];

    v_deck_ids             UUID[];
    v_include_tags         UUID[];
    v_tag_logic            TEXT;
    v_include_learning     BOOLEAN;
    v_contains_language    TEXT;
    v_srs_stages           TEXT[];

    v_date_field_key       TEXT;
    v_date_field_keys      TEXT[] := ARRAY['createdDate', 'updatedDate', 'lastReviewed', 'nextReviewDue'];
    v_db_column            TEXT;
    v_date_op_json         TEXT;
    v_date_val_json        TEXT;
    v_date_range_json      JSONB;
    v_start_date           TEXT;
    v_end_date             TEXT;
    v_current_date_clauses TEXT[];
    
    -- For p_random_seed if we were to use it (original v10 had fixed ordering)
    -- v_local_random_seed REAL; -- Example if random ordering was re-introduced based on p_random_seed
BEGIN
    -- IF p_random_seed IS NOT NULL THEN -- Optional: set seed if dynamic random ordering were added
    --    SELECT setseed(p_random_seed) INTO v_local_random_seed;
    -- END IF;

    -- Determine the query criteria to use (NEW LOGIC BLOCK)
    IF p_study_set_id IS NOT NULL THEN
        SELECT ss.query_criteria INTO v_query_criteria
        FROM public.study_sets ss
        WHERE ss.id = p_study_set_id AND ss.user_id = p_user_id;
        
        IF v_query_criteria IS NULL THEN
            RAISE EXCEPTION 'Study set not found or user mismatch for ID %', p_study_set_id;
        END IF;
        RAISE LOG '[resolve_study_query_v11_targeted] Using criteria from study_set_id: %', p_study_set_id;
    ELSIF p_input_criteria IS NOT NULL THEN
        v_query_criteria := p_input_criteria;
        RAISE LOG '[resolve_study_query_v11_targeted] Using direct input criteria: %', p_input_criteria;
    ELSE
        RAISE EXCEPTION 'Either p_input_criteria or p_study_set_id must be provided to resolve_study_query.';
    END IF;

    -- Original v10 logic starts here, adapted to use v_query_criteria 
    -- instead of p_query_criteria (which is now p_input_criteria)
    RAISE LOG '[resolve_study_query_v11_targeted] User: %, Effective Criteria: %', p_user_id, v_query_criteria;

    v_where_clauses := array_append(v_where_clauses, format('c.user_id = %L', p_user_id));

    -- Extract criteria from v_query_criteria
    IF jsonb_typeof(v_query_criteria->'deckIds') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_deck_ids FROM jsonb_array_elements_text(v_query_criteria->'deckIds') elem;
    END IF;
    v_deck_ids := COALESCE(v_deck_ids, ARRAY[]::UUID[]);

    v_tag_logic := COALESCE(v_query_criteria->>'tagLogic', 'ANY');
    v_include_learning := COALESCE((v_query_criteria->>'includeLearning')::BOOLEAN, FALSE);
    v_contains_language := v_query_criteria->>'containsLanguage';

    -- srsStages extraction - THIS IS THE CORE MODIFIED BLOCK
    DECLARE
        v_srs_filter_text TEXT;
    BEGIN
        v_srs_filter_text := v_query_criteria->>'srsFilter';
        IF v_srs_filter_text IS NOT NULL AND v_srs_filter_text <> 'all' AND v_srs_filter_text <> 'none' THEN
            IF v_srs_filter_text = 'new' THEN
                v_srs_stages := ARRAY['new'];
            ELSIF v_srs_filter_text = 'learning' THEN
                v_srs_stages := ARRAY['learning', 'relearning'];
            ELSIF v_srs_filter_text = 'young' THEN
                v_srs_stages := ARRAY['young'];
            ELSIF v_srs_filter_text = 'mature' THEN
                v_srs_stages := ARRAY['mature'];
            -- No 'due' here as it's handled by date filters typically or a dedicated isDueFilter flag
            ELSE
                v_srs_stages := '{}'::TEXT[]; -- Default to empty for unknown/unhandled srsFilter values
            END IF;
            RAISE LOG '[resolve_study_query_v11_targeted] Translated srsFilter "%": v_srs_stages set to %', v_srs_filter_text, v_srs_stages;
        ELSE
            -- Fallback to direct srsStages if srsFilter is not informative or not present
            IF jsonb_typeof(v_query_criteria->'srsStages') = 'array' THEN
                SELECT array_agg(elem::text) INTO v_srs_stages FROM jsonb_array_elements_text(v_query_criteria->'srsStages') elem;
            END IF;
            v_srs_stages := COALESCE(v_srs_stages, ARRAY[]::TEXT[]);
            IF array_length(v_srs_stages, 1) > 0 THEN
                RAISE LOG '[resolve_study_query_v11_targeted] Used srsStages directly from criteria: %', v_srs_stages;
            ELSIF v_srs_filter_text IS NOT NULL THEN 
                RAISE LOG '[resolve_study_query_v11_targeted] srsFilter was "%" or "none", no srsStages applied based on srsFilter.', v_srs_filter_text;
            END IF;
        END IF;
    END; -- End of inner DECLARE block for srsFilter translation

    -- Tag arrays (using v_query_criteria)
    IF jsonb_typeof(v_query_criteria->'includeTags') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_include_tags FROM jsonb_array_elements_text(v_query_criteria->'includeTags') elem;
    END IF;
    v_include_tags := COALESCE(v_include_tags, ARRAY[]::UUID[]);

    -- Deck filter (multiple IDs) - Original v10 logic
    IF array_length(v_deck_ids, 1) > 0 THEN
        v_where_clauses := array_append(v_where_clauses, format('c.deck_id = ANY(%L::uuid[])', v_deck_ids));
    END IF;

    -- Tag filtering - Original v10 logic for includeTags
    IF array_length(v_include_tags, 1) > 0 THEN
        IF v_join_clauses !~ 'JOIN public.deck_tags' THEN 
            v_join_clauses := v_join_clauses || ' JOIN public.decks d_tags ON c.deck_id = d_tags.id LEFT JOIN public.deck_tags dt ON d_tags.id = dt.deck_id';
        END IF;
        IF v_tag_logic = 'ALL' THEN
             v_where_clauses := array_append(v_where_clauses, format(
                'EXISTS (SELECT 1 FROM public.deck_tags d_all_tags WHERE d_all_tags.deck_id = c.deck_id AND d_all_tags.tag_id = ANY(%L::uuid[]) GROUP BY d_all_tags.deck_id HAVING COUNT(DISTINCT d_all_tags.tag_id) = %s)',
                v_include_tags, array_length(v_include_tags,1) ));
        ELSE -- ANY
            v_where_clauses := array_append(v_where_clauses, format(
                'EXISTS (SELECT 1 FROM public.deck_tags d_any_tags WHERE d_any_tags.deck_id = c.deck_id AND d_any_tags.tag_id = ANY(%L::uuid[]))',
                v_include_tags ));
        END IF;
    END IF;

    -- 'includeLearning' filter - Original v10 logic
    IF v_include_learning IS TRUE THEN
        v_where_clauses := array_append(v_where_clauses, '(c.srs_level = 0 AND (c.learning_state IS NULL OR c.learning_state = ''learning''))');
    END IF;

    -- Language Filter - Original v10 logic (using v_query_criteria for source)
    IF v_contains_language IS NOT NULL AND char_length(v_contains_language) = 2 THEN
        IF v_join_clauses !~ 'JOIN public.decks d_lang' THEN
            v_join_clauses := v_join_clauses || ' JOIN public.decks d_lang ON c.deck_id = d_lang.id';
        END IF;
        v_where_clauses := array_append(v_where_clauses,
            format('(d_lang.primary_language = %L OR (d_lang.is_bilingual IS TRUE AND d_lang.secondary_language = %L))',
                   v_contains_language, v_contains_language)
        );
        RAISE LOG '[resolve_study_query_v11_targeted] Applied containsLanguage filter: %', v_contains_language;
    END IF;

    -- SRS Stage Filter - Uses translated v_srs_stages
    IF array_length(v_srs_stages, 1) > 0 THEN
        IF v_join_clauses !~ 'JOIN public.cards_with_srs_stage cws' THEN
            v_join_clauses := v_join_clauses || ' JOIN public.cards_with_srs_stage cws ON c.id = cws.id';
        END IF;
        v_where_clauses := array_append(v_where_clauses, format('cws.srs_stage = ANY(%L::text[])', v_srs_stages));
        RAISE LOG '[resolve_study_query_v11_targeted] Applied srsStages filter: %', v_srs_stages;
    END IF;

    -- Date Filters - Original v10 logic (using v_query_criteria for source)
    FOREACH v_date_field_key IN ARRAY v_date_field_keys LOOP
        v_current_date_clauses := ARRAY[]::TEXT[];
        -- Original v10 mapping for v_db_column was more concise but this is equivalent
        v_db_column := CASE v_date_field_key
                         WHEN 'createdDate' THEN 'c.created_at'
                         WHEN 'updatedDate' THEN 'c.updated_at'
                         WHEN 'lastReviewed' THEN 'c.last_reviewed_at'
                         WHEN 'nextReviewDue' THEN 'c.next_review_due'
                         ELSE '' END; -- Original v10 had this, ensure loop handles empty v_db_column or skip
        
        IF v_db_column = '' THEN CONTINUE; END IF; -- Skip if no valid db_column mapped

        v_date_op_json := v_query_criteria->v_date_field_key->>'operator';
        v_date_val_json := v_query_criteria->v_date_field_key->>'value';
        v_date_range_json := v_query_criteria->v_date_field_key->'value';

        IF v_date_op_json IS NOT NULL AND v_date_op_json <> 'any' THEN
            IF v_date_op_json = 'newerThanDays' AND v_date_val_json IS NOT NULL AND v_date_val_json ~ '^\d+$' THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('%s >= (NOW() - interval ''1 day'' * (%L::integer))', v_db_column, v_date_val_json));
            ELSIF v_date_op_json = 'olderThanDays' AND v_date_val_json IS NOT NULL AND v_date_val_json ~ '^\d+$' THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('%s < (NOW() - interval ''1 day'' * (%L::integer))', v_db_column, v_date_val_json));
            ELSIF v_date_op_json = 'onDate' AND v_date_val_json IS NOT NULL THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('%s::date = %L::date', v_db_column, v_date_val_json));
            ELSIF v_date_op_json = 'betweenDates' AND jsonb_typeof(v_date_range_json) = 'array' AND jsonb_array_length(v_date_range_json) = 2 THEN
                v_start_date := v_date_range_json->>0; v_end_date := v_date_range_json->>1;
                IF v_start_date IS NOT NULL AND v_start_date <> 'null' THEN v_current_date_clauses := array_append(v_current_date_clauses, format('%s::date >= %L::date', v_db_column, v_start_date)); END IF;
                IF v_end_date IS NOT NULL AND v_end_date <> 'null' THEN v_current_date_clauses := array_append(v_current_date_clauses, format('%s::date <= %L::date', v_db_column, v_end_date)); END IF;
            ELSIF v_date_op_json = 'never' AND (v_date_field_key = 'lastReviewed' OR v_date_field_key = 'nextReviewDue') THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('%s IS NULL', v_db_column));
            ELSIF v_date_op_json = 'isDue' AND v_date_field_key = 'nextReviewDue' THEN
                v_current_date_clauses := array_append(v_current_date_clauses, format('(%s IS NULL OR %s <= NOW())', v_db_column, v_db_column));
            ELSE RAISE WARNING '[resolve_study_query_v11_targeted] Invalid date op: "%" for %, User %. Ignored.', v_date_op_json, v_db_column, p_user_id; END IF;

            IF (v_date_op_json IN ('newerThanDays', 'olderThanDays', 'onDate', 'betweenDates')) AND
               (v_date_field_key = 'lastReviewed' OR v_date_field_key = 'nextReviewDue') AND
               array_length(v_current_date_clauses, 1) > 0 THEN
                v_current_date_clauses := array_prepend(format('%s IS NOT NULL', v_db_column), v_current_date_clauses);
            END IF;
            IF array_length(v_current_date_clauses, 1) > 0 THEN v_where_clauses := array_append(v_where_clauses, '(' || array_to_string(v_current_date_clauses, ' AND ') || ')'); END IF;
        END IF;
    END LOOP;

    v_sql := 'SELECT c.id ' || v_from_clause || v_join_clauses;
    IF array_length(v_where_clauses, 1) > 0 THEN
        v_sql := v_sql || ' WHERE ' || array_to_string(v_where_clauses, ' AND ');
    END IF;
    -- Original v10 fixed ordering
    v_sql := v_sql || ' ORDER BY c.created_at DESC, c.id DESC NULLS LAST';

    RAISE LOG '[resolve_study_query_v11_targeted] Final SQL: %', v_sql;
    RETURN QUERY EXECUTE v_sql;

EXCEPTION WHEN others THEN
    RAISE WARNING '[resolve_study_query_v11_targeted] Error for User: %, Criteria: %. Error: %', p_user_id, v_query_criteria, SQLERRM;
    RETURN;
END;
$$;

COMMENT ON FUNCTION public.resolve_study_query(uuid, jsonb, uuid, real) IS
'Resolves study query criteria into card IDs. v11_targeted: Handles study_set_id and translates srsFilter from its criteria, otherwise uses input_criteria. Keeps original v10 tag, includeLearning, date, and ordering logic.'; 