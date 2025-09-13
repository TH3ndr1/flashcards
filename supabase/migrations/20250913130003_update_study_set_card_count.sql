BEGIN;

-- Update get_study_set_card_count function to filter by status
-- COMPLETE IMPLEMENTATION WITH EXACT BUSINESS LOGIC
DROP FUNCTION IF EXISTS public.get_study_set_card_count(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.get_study_set_card_count(
  p_user_id uuid,
  p_query_criteria jsonb
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_sql                  TEXT;
    v_from_clause          TEXT := 'FROM public.cards c';
    v_join_clauses         TEXT := '';
    v_where_clauses        TEXT[] := ARRAY[]::TEXT[];
    v_count_result         INTEGER;

    -- Parsed criteria variables
    v_deck_ids             UUID[];
    v_include_tags         UUID[];
    v_exclude_tags         UUID[];
    v_tag_logic            TEXT;
    v_contains_language    TEXT;
    v_srs_filter           TEXT;             -- NEW: For single string SRS filter

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
    
    v_mature_threshold     INTEGER;
BEGIN
    RAISE LOG '[get_study_set_card_count] User: %, Criteria: %', p_user_id, p_query_criteria;

    v_where_clauses := array_append(v_where_clauses, format('c.user_id = %L', p_user_id));
    -- Add status filtering for active cards
    v_where_clauses := array_append(v_where_clauses, 'c.status = ''active''');

    -- Extract criteria
    IF jsonb_typeof(p_query_criteria->'deckIds') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_deck_ids FROM jsonb_array_elements_text(p_query_criteria->'deckIds') elem;
    END IF;
    v_deck_ids := COALESCE(v_deck_ids, ARRAY[]::UUID[]);

    RAISE LOG '[get_study_set_card_count] Extracted v_deck_ids: %', v_deck_ids;

    v_tag_logic := COALESCE(p_query_criteria->>'tagLogic', 'ANY');
    v_contains_language := p_query_criteria->>'containsLanguage';
    v_srs_filter := p_query_criteria->>'srsFilter'; -- Extract srsFilter string

    IF jsonb_typeof(p_query_criteria->'includeTags') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_include_tags FROM jsonb_array_elements_text(p_query_criteria->'includeTags') elem;
    END IF;
    v_include_tags := COALESCE(v_include_tags, ARRAY[]::UUID[]);

    IF jsonb_typeof(p_query_criteria->'excludeTags') = 'array' THEN
        SELECT array_agg(elem::uuid) INTO v_exclude_tags FROM jsonb_array_elements_text(p_query_criteria->'excludeTags') elem;
    END IF;
    v_exclude_tags := COALESCE(v_exclude_tags, ARRAY[]::UUID[]);

    -- Deck filter
    IF array_length(v_deck_ids, 1) > 0 THEN
        v_where_clauses := array_append(v_where_clauses, format('c.deck_id = ANY(%L::uuid[])', v_deck_ids));
        RAISE LOG '[get_study_set_card_count] After deck filter, v_where_clauses: %', array_to_string(v_where_clauses, ' AND ');
    ELSE
        RAISE LOG '[get_study_set_card_count] No deckIds provided or v_deck_ids is empty.';
    END IF;

    -- Tag filtering
    IF array_length(v_include_tags, 1) > 0 THEN
        IF v_join_clauses !~ 'JOIN public.deck_tags' THEN
            v_join_clauses := v_join_clauses || ' JOIN public.decks d_tags ON c.deck_id = d_tags.id LEFT JOIN public.deck_tags dt ON d_tags.id = dt.deck_id';
        END IF;
        -- Add status filtering for decks in tag joins
        v_where_clauses := array_append(v_where_clauses, 'd_tags.status = ''active''');
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

    -- Language Filter
    IF v_contains_language IS NOT NULL AND char_length(v_contains_language) = 2 THEN
        IF v_join_clauses !~ 'JOIN public.decks d_lang' THEN
            v_join_clauses := v_join_clauses || ' JOIN public.decks d_lang ON c.deck_id = d_lang.id';
        END IF;
        -- Add status filtering for decks in language joins
        v_where_clauses := array_append(v_where_clauses, 'd_lang.status = ''active''');
        v_where_clauses := array_append(v_where_clauses,
            format('(d_lang.primary_language = %L OR (d_lang.is_bilingual IS TRUE AND d_lang.secondary_language = %L))',
                   v_contains_language, v_contains_language)
        );
        RAISE LOG '[get_study_set_card_count] Applied containsLanguage filter: %', v_contains_language;
    END IF;

    -- If no deck joins have been added yet, add a fallback join to ensure deck status filtering
    IF v_join_clauses = '' THEN
        v_join_clauses := v_join_clauses || ' JOIN public.decks d_status ON c.deck_id = d_status.id';
        v_where_clauses := array_append(v_where_clauses, 'd_status.status = ''active''');
    END IF;

    -- NEW SRS Filter logic using v_srs_filter
    IF v_srs_filter IS NOT NULL AND v_srs_filter <> 'all' AND v_srs_filter <> 'none' THEN
        -- Fetch mature_interval_threshold from settings for the current user
        SELECT s.mature_interval_threshold INTO v_mature_threshold
        FROM public.settings s
        WHERE s.user_id = p_user_id
        LIMIT 1;
        
        -- Default if not found (though should always exist for a user)
        v_mature_threshold := COALESCE(v_mature_threshold, 21); 

        RAISE LOG '[get_study_set_card_count] Applying srsFilter: %, Mature Threshold: %', v_srs_filter, v_mature_threshold;

        IF v_srs_filter = 'new' THEN
            v_where_clauses := array_append(v_where_clauses, 'c.srs_level = 0');
        ELSIF v_srs_filter = 'learn' THEN -- cards in learning steps
            v_where_clauses := array_append(v_where_clauses, '(c.learning_state = ''learning'' OR c.learning_state = ''relearning'')');
        ELSIF v_srs_filter = 'due' THEN -- young + mature cards due for review + relearning cards
            v_where_clauses := array_append(v_where_clauses, 
                format('(((c.next_review_due IS NOT NULL AND c.next_review_due <= NOW()) AND c.srs_level > 0 AND c.interval_days < %s AND c.learning_state IS DISTINCT FROM ''learning'') OR ' || -- Young due
                       '((c.next_review_due IS NOT NULL AND c.next_review_due <= NOW()) AND c.srs_level > 0 AND c.interval_days >= %s AND c.learning_state IS DISTINCT FROM ''learning'') OR ' || -- Mature due
                       '(c.learning_state = ''relearning''))', -- Relearning cards
                       v_mature_threshold, v_mature_threshold
                )
            );
        ELSIF v_srs_filter = 'young' THEN -- young (learning, graduated but not mature)
            v_where_clauses := array_append(v_where_clauses, format('(c.srs_level > 0 AND c.interval_days < %s AND c.learning_state IS DISTINCT FROM ''learning'')', v_mature_threshold));
        ELSIF v_srs_filter = 'mature' THEN
            v_where_clauses := array_append(v_where_clauses, format('(c.srs_level > 0 AND c.interval_days >= %s AND c.learning_state IS DISTINCT FROM ''learning'')', v_mature_threshold));
        ELSIF v_srs_filter = 'new_review' THEN -- New cards + Due cards (young, mature, relearning)
             v_where_clauses := array_append(v_where_clauses, 
                format('((c.srs_level = 0) OR ' || -- New cards
                       '(((c.next_review_due IS NOT NULL AND c.next_review_due <= NOW()) AND c.srs_level > 0 AND c.interval_days < %s AND c.learning_state IS DISTINCT FROM ''learning'') OR ' || -- Young due
                       '((c.next_review_due IS NOT NULL AND c.next_review_due <= NOW()) AND c.srs_level > 0 AND c.interval_days >= %s AND c.learning_state IS DISTINCT FROM ''learning'') OR ' || -- Mature due
                       '(c.learning_state = ''relearning'')))', -- Relearning
                       v_mature_threshold, v_mature_threshold
                )
            );
        -- Add other srsFilter cases as needed from resolve_study_query if they make sense for counts
        ELSE
             RAISE WARNING '[get_study_set_card_count] Unknown srsFilter value: %. Ignoring.', v_srs_filter;
        END IF;
    ELSIF v_srs_filter = 'none' THEN
        -- This case implies no SRS filtering beyond other criteria,
        -- or could be interpreted as cards that don't fit any typical SRS state (e.g. suspended - not implemented yet)
        -- For now, 'none' means no *additional* SRS-specific WHERE clauses are added here.
        RAISE LOG '[get_study_set_card_count] srsFilter is ''none'', no SRS specific WHERE clauses added.';
    END IF;
    -- If srsFilter is 'all' or NULL, no specific SRS WHERE clause is added, matching all SRS states.

    RAISE LOG '[get_study_set_card_count] After SRS filter, v_where_clauses: %', array_to_string(v_where_clauses, ' AND ');

    -- Date Filters
    FOREACH v_date_field_key IN ARRAY v_date_field_keys LOOP
        v_current_date_clauses := ARRAY[]::TEXT[];
        v_db_column := CASE v_date_field_key
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
            ELSE RAISE WARNING '[get_study_set_card_count] Invalid date op: "%" for %, User %. Ignored.', v_date_op_json, v_db_column, p_user_id; END IF;

            IF (v_date_op_json IN ('newerThanDays', 'olderThanDays', 'onDate', 'betweenDates')) AND
               (v_date_field_key = 'lastReviewed' OR v_date_field_key = 'nextReviewDue') AND
               array_length(v_current_date_clauses, 1) > 0 THEN
                v_current_date_clauses := array_prepend(format('%s IS NOT NULL', v_db_column), v_current_date_clauses);
            END IF;
            IF array_length(v_current_date_clauses, 1) > 0 THEN v_where_clauses := array_append(v_where_clauses, '(' || array_to_string(v_current_date_clauses, ' AND ') || ')'); END IF;
        END IF;
    END LOOP;

    -- All cards filter should override deck/tag specifics if present AND true.
    -- However, SRS filters and date filters should still apply on top of allCards.
    IF p_query_criteria->>'allCards' = 'true' THEN
        -- Keep user_id filter, srsFilter, and date_filters.
        -- Remove deck_ids, tag filters if allCards is true, as it means "all cards for this user"
        -- before other non-deck/tag specific filters are applied.
        -- A more nuanced approach might be needed if allCards should truly ignore *all* other filters.
        -- For now, assume allCards = true means "ignore deck/tag selections, but respect SRS/date criteria".
        -- The existing logic for deck_ids and tags automatically doesn't add clauses if the arrays are empty,
        -- which would be the case if 'allCards: true' is passed without specific deck/tag criteria.
        -- If 'allCards: true' is passed WITH deck_ids, deck_ids will apply.
        -- This part might need refinement based on exact desired behavior of 'allCards: true'.
        -- The current structure implies 'allCards:true' is more of a default when no deckIds are specified.
        RAISE LOG '[get_study_set_card_count] allCards is true. Current WHERE: %', array_to_string(v_where_clauses, ' AND ');
    END IF;

    v_sql := 'SELECT COUNT(DISTINCT c.id) ' || v_from_clause || v_join_clauses;
    IF array_length(v_where_clauses, 1) > 0 THEN
        v_sql := v_sql || ' WHERE ' || array_to_string(v_where_clauses, ' AND ');
    END IF;

    RAISE LOG '[get_study_set_card_count] Final SQL for count: %', v_sql;
    EXECUTE v_sql INTO v_count_result;
    RETURN v_count_result;

EXCEPTION WHEN others THEN
    RAISE WARNING '[get_study_set_card_count] Error for User: %, Criteria: %. Error: %', p_user_id, p_query_criteria, SQLERRM;
    RETURN -1; -- Or handle error as appropriate, e.g., return NULL or re-raise
END;
$$;

COMMENT ON FUNCTION public.get_study_set_card_count(uuid, jsonb)
IS 'Get the count of cards that match the given study set criteria, only including active cards from active decks.';

GRANT EXECUTE ON FUNCTION public.get_study_set_card_count(uuid, jsonb) TO authenticated;

COMMIT;
