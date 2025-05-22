-- Migration: Update resolve_study_query for new filters (language, multi-deck, SRS stages)
-- Version: 10
-- Description: This migration updates public.resolve_study_query(uuid, jsonb) to:
--              1. Support filtering by an array of deck_ids.
--              2. Add filtering by 'containsLanguage' (checks deck's primary or secondary language).
--              3. Replace numeric SRS level filter with filtering by an array of 'srsStages'
--                 (requires joining with cards_with_srs_stage view).
--              4. Retains existing filters (user, tags, includeLearning, dates).

DROP FUNCTION IF EXISTS public.resolve_study_query(uuid, jsonb);

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
    v_join_clauses         TEXT := '';
    v_where_clauses        TEXT[] := ARRAY[]::TEXT[];

    -- Parsed criteria variables
    v_deck_ids             UUID[]; -- Changed from v_deck_id
    v_include_tags         UUID[];
    v_exclude_tags         UUID[];
    v_tag_logic            TEXT;
    v_include_learning     BOOLEAN;
    v_contains_language    TEXT;   -- NEW
    v_srs_stages           TEXT[]; -- NEW (replaces srs_level_op/value)

    -- Date related variables (same as v8/v9)
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
    RAISE LOG '[resolve_study_query_v10] User: %, Criteria: %', p_user_id, p_query_criteria;

    v_where_clauses := array_append(v_where_clauses, format('c.user_id = %L', p_user_id));

    -- Extract criteria
    IF jsonb_typeof(p_query_criteria->'deckIds') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_deck_ids FROM jsonb_array_elements_text(p_query_criteria->'deckIds') elem;
    END IF;
    v_deck_ids := COALESCE(v_deck_ids, ARRAY[]::UUID[]);

    v_tag_logic := COALESCE(p_query_criteria->>'tagLogic', 'ANY');
    v_include_learning := COALESCE((p_query_criteria->>'includeLearning')::BOOLEAN, FALSE);
    v_contains_language := p_query_criteria->>'containsLanguage'; -- Will be null if not present

    IF jsonb_typeof(p_query_criteria->'srsStages') = 'array' THEN
        SELECT array_agg(elem::text) INTO v_srs_stages FROM jsonb_array_elements_text(p_query_criteria->'srsStages') elem;
    END IF;
    v_srs_stages := COALESCE(v_srs_stages, ARRAY[]::TEXT[]);

    -- Tag arrays (same as before)
    IF jsonb_typeof(p_query_criteria->'includeTags') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_include_tags FROM jsonb_array_elements_text(p_query_criteria->'includeTags') elem;
    END IF;
    v_include_tags := COALESCE(v_include_tags, ARRAY[]::UUID[]);
    IF jsonb_typeof(p_query_criteria->'excludeTags') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_exclude_tags FROM jsonb_array_elements_text(p_query_criteria->'excludeTags') elem;
    END IF;
    v_exclude_tags := COALESCE(v_exclude_tags, ARRAY[]::UUID[]);


    -- Deck filter (multiple IDs)
    IF array_length(v_deck_ids, 1) > 0 THEN
        v_where_clauses := array_append(v_where_clauses, format('c.deck_id = ANY(%L::uuid[])', v_deck_ids));
    END IF;

    -- Tag filtering (same as before)
    IF array_length(v_include_tags, 1) > 0 THEN
        IF v_join_clauses !~ 'JOIN public.deck_tags' THEN -- Add join only if needed
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
    IF array_length(v_exclude_tags, 1) > 0 THEN
         IF v_join_clauses !~ 'JOIN public.deck_tags' AND v_join_clauses !~ 'LEFT JOIN public.deck_tags' THEN
            v_join_clauses := v_join_clauses || ' LEFT JOIN public.deck_tags dt_exclude ON c.deck_id = dt_exclude.deck_id AND dt_exclude.tag_id = ANY(%L::uuid[])';
            v_where_clauses := array_append(v_where_clauses, 'dt_exclude.tag_id IS NULL');
        ELSE
             v_where_clauses := array_append(v_where_clauses, format(
                'NOT EXISTS (SELECT 1 FROM public.deck_tags d_none_tags WHERE d_none_tags.deck_id = c.deck_id AND d_none_tags.tag_id = ANY(%L::uuid[]))',
                 v_exclude_tags ));
        END IF;
    END IF;

    -- 'includeLearning' filter (same as before)
    IF v_include_learning IS TRUE THEN
        v_where_clauses := array_append(v_where_clauses, '(c.srs_level = 0 AND (c.learning_state IS NULL OR c.learning_state = ''learning''))');
    END IF;

    -- NEW Language Filter
    IF v_contains_language IS NOT NULL AND char_length(v_contains_language) = 2 THEN
        IF v_join_clauses !~ 'JOIN public.decks d_lang' THEN -- Add join only if needed by language or other deck property filters
            v_join_clauses := v_join_clauses || ' JOIN public.decks d_lang ON c.deck_id = d_lang.id';
        END IF;
        v_where_clauses := array_append(v_where_clauses,
            format('(d_lang.primary_language = %L OR (d_lang.is_bilingual IS TRUE AND d_lang.secondary_language = %L))',
                   v_contains_language, v_contains_language)
        );
        RAISE LOG '[resolve_study_query_v10] Applied containsLanguage filter: %', v_contains_language;
    END IF;

    -- NEW SRS Stage Filter
    IF array_length(v_srs_stages, 1) > 0 THEN
        IF v_join_clauses !~ 'JOIN public.cards_with_srs_stage cws' THEN -- Add join only if needed
            v_join_clauses := v_join_clauses || ' JOIN public.cards_with_srs_stage cws ON c.id = cws.id';
        END IF;
        v_where_clauses := array_append(v_where_clauses, format('cws.srs_stage = ANY(%L::text[])', v_srs_stages));
        RAISE LOG '[resolve_study_query_v10] Applied srsStages filter: %', v_srs_stages;
    END IF;

    -- Date Filters (same logic as v9)
    FOREACH v_date_field_key IN ARRAY v_date_field_keys LOOP
        v_current_date_clauses := ARRAY[]::TEXT[];
        v_db_column := CASE v_date_field_key /* ... same mapping ... */
                         WHEN 'createdDate' THEN 'c.created_at'
                         WHEN 'updatedDate' THEN 'c.updated_at'
                         WHEN 'lastReviewed' THEN 'c.last_reviewed_at'
                         WHEN 'nextReviewDue' THEN 'c.next_review_due'
                         ELSE '' END;
        v_date_op_json := p_query_criteria->v_date_field_key->>'operator';
        v_date_val_json := p_query_criteria->v_date_field_key->>'value';
        v_date_range_json := p_query_criteria->v_date_field_key->'value';

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
            ELSE RAISE WARNING '[resolve_study_query_v10] Invalid date op: "%" for %, User %. Ignored.', v_date_op_json, v_db_column, p_user_id; END IF;

            IF (v_date_op_json IN ('newerThanDays', 'olderThanDays', 'onDate', 'betweenDates')) AND
               (v_date_field_key = 'lastReviewed' OR v_date_field_key = 'nextReviewDue') AND
               array_length(v_current_date_clauses, 1) > 0 THEN
                v_current_date_clauses := array_prepend(format('%s IS NOT NULL', v_db_column), v_current_date_clauses);
            END IF;
            IF array_length(v_current_date_clauses, 1) > 0 THEN v_where_clauses := array_append(v_where_clauses, '(' || array_to_string(v_current_date_clauses, ' AND ') || ')'); END IF;
        END IF;
    END LOOP;

    v_sql := 'SELECT c.id ' || v_from_clause || v_join_clauses; -- Added v_join_clauses
    IF array_length(v_where_clauses, 1) > 0 THEN
        v_sql := v_sql || ' WHERE ' || array_to_string(v_where_clauses, ' AND ');
    END IF;
    v_sql := v_sql || ' ORDER BY c.created_at DESC, c.id DESC NULLS LAST';

    RAISE LOG '[resolve_study_query_v10] Final SQL: %', v_sql;
    RETURN QUERY EXECUTE v_sql;

EXCEPTION WHEN others THEN
    RAISE WARNING '[resolve_study_query_v10] Error for User: %, Criteria: %. Error: %', p_user_id, p_query_criteria, SQLERRM;
    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_study_query(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.resolve_study_query(uuid, jsonb) IS
'Resolves study query criteria into card IDs. v10: Multi-deck, language filter, SRS stage filter, date filter completion.';