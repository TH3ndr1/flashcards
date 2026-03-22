BEGIN;

-- Fix get_study_set_srs_distribution to filter by card/deck status
--
-- Root cause: When status filtering was added to the other query functions in
-- September 2025 (resolve_study_query, get_study_set_card_count), the
-- get_study_set_srs_distribution function was missed. This caused the playlist
-- listing page to show inflated card counts (including archived/deleted cards)
-- while the actual study session (which uses resolve_study_query) showed the
-- correct, lower number.
--
-- Fix: add c.status = 'active' and deck status filters in the same pattern used
-- by the updated get_study_set_card_count function.

CREATE OR REPLACE FUNCTION public.get_study_set_srs_distribution(
    p_user_id uuid,
    p_query_criteria jsonb
)
RETURNS public.srs_distribution_counts
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_base_sql             TEXT;
    v_from_clause          TEXT := 'FROM public.cards c';
    v_join_clauses         TEXT := '';
    v_where_clauses        TEXT[] := ARRAY[]::TEXT[];
    v_distribution_result  public.srs_distribution_counts;

    v_deck_ids             UUID[];
    v_include_tags         UUID[];
    v_tag_logic            TEXT;
    v_contains_language    TEXT;

    v_date_field_key       TEXT;
    v_date_field_keys      TEXT[] := ARRAY['createdDate', 'updatedDate', 'lastReviewed', 'nextReviewDue'];
    v_db_column            TEXT;
    v_date_op_json         TEXT;
    v_date_val_json        TEXT;
    v_date_range_json      JSONB;
    v_start_date           TEXT;
    v_end_date             TEXT;
    v_current_date_clauses TEXT[];

    v_mature_threshold     INTEGER;
    v_dynamic_where_conditions TEXT;
    v_actionable_srs_condition TEXT;

    DECLARE
        temp_new_count INTEGER;
        temp_learning_count INTEGER;
        temp_relearning_count INTEGER;
        temp_young_count INTEGER;
        temp_mature_count INTEGER;
        total_cards_in_filtered_set INTEGER;
BEGIN
    RAISE LOG '[get_study_set_srs_distribution_v2] User: %, Criteria: %', p_user_id, p_query_criteria;

    -- User filter
    v_where_clauses := array_append(v_where_clauses, format('c.user_id = %L', p_user_id));
    -- *** STATUS FIX: only count active cards (mirrors resolve_study_query and get_study_set_card_count) ***
    v_where_clauses := array_append(v_where_clauses, 'c.status = ''active''');

    -- Extract criteria
    IF jsonb_typeof(p_query_criteria->'deckIds') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_deck_ids FROM jsonb_array_elements_text(p_query_criteria->'deckIds') elem;
    END IF;
    v_deck_ids := COALESCE(v_deck_ids, ARRAY[]::UUID[]);

    v_tag_logic := COALESCE(p_query_criteria->>'tagLogic', 'ANY');
    v_contains_language := p_query_criteria->>'containsLanguage';

    IF jsonb_typeof(p_query_criteria->'includeTags') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_include_tags FROM jsonb_array_elements_text(p_query_criteria->'includeTags') elem;
    END IF;
    v_include_tags := COALESCE(v_include_tags, ARRAY[]::UUID[]);

    -- Deck filter
    IF array_length(v_deck_ids, 1) > 0 THEN
        v_where_clauses := array_append(v_where_clauses, format('c.deck_id = ANY(%L::uuid[])', v_deck_ids));
    END IF;

    -- Tag filtering
    IF array_length(v_include_tags, 1) > 0 THEN
        IF v_join_clauses !~ 'JOIN public.deck_tags' AND v_join_clauses !~ 'LEFT JOIN public.deck_tags' THEN
             v_join_clauses := v_join_clauses || ' JOIN public.decks d_tags_incl ON c.deck_id = d_tags_incl.id LEFT JOIN public.deck_tags dt_incl ON d_tags_incl.id = dt_incl.deck_id';
        END IF;
        -- *** STATUS FIX: filter out archived/deleted decks when filtering by tag ***
        v_where_clauses := array_append(v_where_clauses, 'd_tags_incl.status = ''active''');
        IF v_tag_logic = 'ALL' THEN
             v_where_clauses := array_append(v_where_clauses, format(
                '(SELECT COUNT(DISTINCT dt_all.tag_id) FROM public.deck_tags dt_all WHERE dt_all.deck_id = c.deck_id AND dt_all.tag_id = ANY(%L::uuid[])) = %s',
                v_include_tags, array_length(v_include_tags,1) ));
        ELSE -- ANY
            v_where_clauses := array_append(v_where_clauses, format(
                'EXISTS (SELECT 1 FROM public.deck_tags dt_any WHERE dt_any.deck_id = c.deck_id AND dt_any.tag_id = ANY(%L::uuid[]))',
                v_include_tags ));
        END IF;
    END IF;

    -- Language Filter
    IF v_contains_language IS NOT NULL AND char_length(v_contains_language) = 2 THEN
        DECLARE
            v_deck_alias_for_lang TEXT;
        BEGIN
            IF array_length(v_include_tags, 1) > 0 THEN
                v_deck_alias_for_lang := 'd_tags_incl';
            ELSE
                IF v_join_clauses !~ 'JOIN public.decks d_lang ON c.deck_id = d_lang.id' THEN
                    v_join_clauses := v_join_clauses || ' JOIN public.decks d_lang ON c.deck_id = d_lang.id';
                END IF;
                v_deck_alias_for_lang := 'd_lang';
                -- *** STATUS FIX: filter out archived/deleted decks when filtering by language ***
                v_where_clauses := array_append(v_where_clauses, 'd_lang.status = ''active''');
            END IF;

            v_where_clauses := array_append(v_where_clauses,
                format('(%s.primary_language = %L OR (%s.is_bilingual IS TRUE AND %s.secondary_language = %L))',
                       v_deck_alias_for_lang, v_contains_language, v_deck_alias_for_lang, v_deck_alias_for_lang, v_contains_language)
            );
        END;
    END IF;

    -- *** STATUS FIX: fallback deck join to ensure deck status is always filtered,
    --     even when no tag/language join was added above ***
    IF v_join_clauses = '' THEN
        v_join_clauses := v_join_clauses || ' JOIN public.decks d_status ON c.deck_id = d_status.id';
        v_where_clauses := array_append(v_where_clauses, 'd_status.status = ''active''');
    END IF;

    -- Date Filters
    FOREACH v_date_field_key IN ARRAY v_date_field_keys LOOP
        v_current_date_clauses := ARRAY[]::TEXT[];
        v_db_column := CASE v_date_field_key
                         WHEN 'createdDate' THEN 'c.created_at'
                         WHEN 'updatedDate' THEN 'c.updated_at'
                         WHEN 'lastReviewed' THEN 'c.last_reviewed_at'
                         WHEN 'nextReviewDue' THEN 'c.next_review_due'
                         ELSE '' END;
        IF v_db_column = '' THEN CONTINUE; END IF;

        IF p_query_criteria->v_date_field_key IS NOT NULL AND jsonb_typeof(p_query_criteria->v_date_field_key) = 'object' THEN
            v_date_op_json := p_query_criteria->v_date_field_key->>'operator';
            v_date_val_json := p_query_criteria->v_date_field_key->>'value';
            v_date_range_json := p_query_criteria->v_date_field_key->'value';

            IF v_date_op_json IS NOT NULL AND v_date_op_json <> 'any' THEN
                IF v_date_op_json = 'newerThanDays' AND v_date_val_json IS NOT NULL AND v_date_val_json ~ '^\d+$' THEN
                    v_current_date_clauses := array_append(v_current_date_clauses, format('%s >= (NOW() - make_interval(days => %L::integer))', v_db_column, v_date_val_json));
                ELSIF v_date_op_json = 'olderThanDays' AND v_date_val_json IS NOT NULL AND v_date_val_json ~ '^\d+$' THEN
                    v_current_date_clauses := array_append(v_current_date_clauses, format('%s < (NOW() - make_interval(days => %L::integer))', v_db_column, v_date_val_json));
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
                END IF;

                IF (v_date_op_json IN ('newerThanDays', 'olderThanDays', 'onDate', 'betweenDates')) AND
                   (v_date_field_key = 'lastReviewed' OR v_date_field_key = 'nextReviewDue') AND
                   array_length(v_current_date_clauses, 1) > 0 THEN
                    v_current_date_clauses := array_prepend(format('%s IS NOT NULL', v_db_column), v_current_date_clauses);
                END IF;
                IF array_length(v_current_date_clauses, 1) > 0 THEN v_where_clauses := array_append(v_where_clauses, '(' || array_to_string(v_current_date_clauses, ' AND ') || ')'); END IF;
            END IF;
        END IF;
    END LOOP;

    IF p_query_criteria->>'allCards' = 'true' THEN
        RAISE LOG '[get_study_set_srs_distribution_v2] allCards is true.';
    END IF;

    -- Fetch mature_interval_threshold
    SELECT s.mature_interval_threshold INTO v_mature_threshold
    FROM public.settings s
    WHERE s.user_id = p_user_id
    LIMIT 1;
    v_mature_threshold := COALESCE(v_mature_threshold, 21);

    IF array_length(v_where_clauses, 1) > 0 THEN
        v_dynamic_where_conditions := array_to_string(v_where_clauses, ' AND ');
    ELSE
        v_dynamic_where_conditions := 'TRUE';
    END IF;
    RAISE LOG '[GSSD_LOG] Initial v_dynamic_where_conditions (before srsFilter): %', v_dynamic_where_conditions;

    -- Apply srsFilter
    DECLARE
        v_srs_filter_criteria TEXT := p_query_criteria->>'srsFilter';
        v_srs_filter_clause TEXT := '';
    BEGIN
        IF v_srs_filter_criteria IS NOT NULL AND v_srs_filter_criteria <> 'all' AND v_srs_filter_criteria <> 'none' THEN
            IF v_srs_filter_criteria = 'new' THEN
                v_srs_filter_clause := '(c.srs_level = 0 AND c.learning_state IS NULL)';
            ELSIF v_srs_filter_criteria = 'learning' THEN
                v_srs_filter_clause := '(c.learning_state = ''learning'' OR c.learning_state = ''relearning'')';
            ELSIF v_srs_filter_criteria = 'young' THEN
                 v_srs_filter_clause := format('(c.srs_level > 0 AND c.interval_days < %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'')', v_mature_threshold);
            ELSIF v_srs_filter_criteria = 'mature' THEN
                 v_srs_filter_clause := format('(c.srs_level > 0 AND c.interval_days >= %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'')', v_mature_threshold);
            ELSIF v_srs_filter_criteria = 'due' THEN
                v_srs_filter_clause := '( ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = ''relearning'')) AND c.next_review_due <= NOW() )';
            ELSIF v_srs_filter_criteria = 'new_review' THEN
                v_srs_filter_clause := '( (c.srs_level = 0 AND c.learning_state IS NULL) OR (c.srs_level = 0 AND c.learning_state = ''learning'') OR ( ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = ''relearning'')) AND c.next_review_due <= NOW() ) )';
            END IF;

            IF v_srs_filter_clause <> '' THEN
                IF v_dynamic_where_conditions = 'TRUE' THEN
                    v_dynamic_where_conditions := v_srs_filter_clause;
                ELSE
                    v_dynamic_where_conditions := v_dynamic_where_conditions || ' AND ' || v_srs_filter_clause;
                END IF;
            END IF;
        END IF;
    END;
    RAISE LOG '[GSSD_LOG] Final v_dynamic_where_conditions (after srsFilter): %', v_dynamic_where_conditions;

    -- Actionable SRS condition
    v_actionable_srs_condition := CASE p_query_criteria->>'srsFilter'
        WHEN 'new' THEN 'c.srs_level = 0'
        WHEN 'learning' THEN '(c.learning_state = ''learning'' OR c.learning_state = ''relearning'')'
        WHEN 'young' THEN format('(c.srs_level > 0 AND c.interval_days < %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'' AND c.next_review_due <= NOW())', v_mature_threshold)
        WHEN 'mature' THEN format('(c.srs_level > 0 AND c.interval_days >= %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'' AND c.next_review_due <= NOW())', v_mature_threshold)
        WHEN 'due' THEN '( ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = ''relearning'')) AND c.next_review_due <= NOW() )'
        WHEN 'new_review' THEN '( (c.srs_level = 0 AND c.learning_state IS NULL) OR (c.srs_level = 0 AND c.learning_state = ''learning'') OR ( ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = ''relearning'')) AND c.next_review_due <= NOW() ) )'
        ELSE '( (c.srs_level = 0 AND c.learning_state IS NULL) OR (c.srs_level = 0 AND c.learning_state = ''learning'') OR ( ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = ''relearning'')) AND c.next_review_due <= NOW() ) )'
    END;

    -- Main SRS distribution query
    v_base_sql := format(
        'SELECT ' ||
        '   COUNT(DISTINCT CASE WHEN c.srs_level = 0 AND c.learning_state IS NULL THEN c.id ELSE NULL END)::BIGINT AS new_count, ' ||
        '   COUNT(DISTINCT CASE WHEN c.learning_state = ''learning'' THEN c.id ELSE NULL END)::BIGINT AS learning_count, ' ||
        '   COUNT(DISTINCT CASE WHEN c.learning_state = ''relearning'' THEN c.id ELSE NULL END)::BIGINT AS relearning_count, ' ||
        '   COUNT(DISTINCT CASE WHEN c.srs_level > 0 AND c.interval_days < %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'' THEN c.id ELSE NULL END)::BIGINT AS young_count, ' ||
        '   COUNT(DISTINCT CASE WHEN c.srs_level > 0 AND c.interval_days >= %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'' THEN c.id ELSE NULL END)::BIGINT AS mature_count, ' ||
        '   COUNT(DISTINCT c.id)::BIGINT AS total_for_set ' ||
        '%s %s WHERE %s',
        v_mature_threshold, v_mature_threshold, v_from_clause, v_join_clauses, v_dynamic_where_conditions
    );
    RAISE LOG '[get_study_set_srs_distribution_v2] Final SQL: %', v_base_sql;

    EXECUTE v_base_sql
    INTO temp_new_count, temp_learning_count, temp_relearning_count, temp_young_count, temp_mature_count, total_cards_in_filtered_set;

    -- Populate result based on srsFilter
    DECLARE
        v_srs_filter_val TEXT := p_query_criteria->>'srsFilter';
    BEGIN
        IF v_srs_filter_val = 'new' THEN
            v_distribution_result.new_count = total_cards_in_filtered_set;
            v_distribution_result.learning_count = 0;
            v_distribution_result.relearning_count = 0;
            v_distribution_result.young_count = 0;
            v_distribution_result.mature_count = 0;
        ELSIF v_srs_filter_val = 'learning' THEN
            v_distribution_result.new_count = 0;
            v_distribution_result.learning_count = temp_learning_count;
            v_distribution_result.relearning_count = temp_relearning_count;
            v_distribution_result.young_count = 0;
            v_distribution_result.mature_count = 0;
        ELSIF v_srs_filter_val = 'young' THEN
            v_distribution_result.new_count = 0;
            v_distribution_result.learning_count = 0;
            v_distribution_result.relearning_count = 0;
            v_distribution_result.young_count = total_cards_in_filtered_set;
            v_distribution_result.mature_count = 0;
        ELSIF v_srs_filter_val = 'mature' THEN
            v_distribution_result.new_count = 0;
            v_distribution_result.learning_count = 0;
            v_distribution_result.relearning_count = 0;
            v_distribution_result.young_count = 0;
            v_distribution_result.mature_count = total_cards_in_filtered_set;
        ELSE
            v_distribution_result.new_count = temp_new_count;
            v_distribution_result.learning_count = temp_learning_count;
            v_distribution_result.relearning_count = temp_relearning_count;
            v_distribution_result.young_count = temp_young_count;
            v_distribution_result.mature_count = temp_mature_count;
        END IF;
    END;

    -- Calculate actionable_count
    DECLARE
        v_srs_filter_for_actionable TEXT := p_query_criteria->>'srsFilter';
    BEGIN
        IF v_srs_filter_for_actionable = 'new' OR v_srs_filter_for_actionable = 'learning' THEN
            v_distribution_result.actionable_count = total_cards_in_filtered_set;
        ELSE
            EXECUTE format(
                'SELECT COUNT(DISTINCT c.id)::BIGINT ' ||
                'FROM public.cards c %s ' ||
                'WHERE (%s) AND (%s)',
                v_join_clauses,
                v_dynamic_where_conditions,
                v_actionable_srs_condition
            )
            INTO v_distribution_result.actionable_count;
        END IF;
    END;

    RETURN v_distribution_result;

EXCEPTION WHEN others THEN
    RAISE WARNING '[get_study_set_srs_distribution_v2] Error for User: %, Criteria: %. Error: %', p_user_id, p_query_criteria, SQLERRM;
    RETURN (0,0,0,0,0,0)::public.srs_distribution_counts;
END;
$$;

COMMENT ON FUNCTION public.get_study_set_srs_distribution(uuid, jsonb)
IS 'Calculate SRS distribution counts for a study set criteria. Only counts active cards from active decks.';

GRANT EXECUTE ON FUNCTION public.get_study_set_srs_distribution(uuid, jsonb) TO authenticated;

COMMIT;
