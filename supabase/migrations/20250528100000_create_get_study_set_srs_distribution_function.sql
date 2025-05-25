-- Migration: Create get_study_set_srs_distribution function
-- Version: 1
-- Description: This migration creates the public.get_study_set_srs_distribution(uuid, jsonb) function.
--              This function calculates the distribution of cards across SRS stages (new, learning, young, mature)
--              and an actionable count (new/review) for a given study set criteria.

DROP FUNCTION IF EXISTS public.get_study_set_srs_distribution(uuid, jsonb);
DROP TYPE IF EXISTS public.srs_distribution_counts; -- Drop type before creating to allow changes

CREATE TYPE public.srs_distribution_counts AS (
    new_count BIGINT,
    learning_count BIGINT,
    relearning_count BIGINT,
    young_count BIGINT,
    mature_count BIGINT,
    actionable_count BIGINT -- Added for new/review cards
);

CREATE OR REPLACE FUNCTION public.get_study_set_srs_distribution(
    p_user_id uuid,
    p_query_criteria jsonb
)
RETURNS public.srs_distribution_counts -- Ensure this matches the new type
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

    -- Parsed criteria variables (copied from get_study_set_card_count)
    v_deck_ids             UUID[];
    v_include_tags         UUID[];
    v_tag_logic            TEXT;
    v_contains_language    TEXT;
    -- v_srs_filter is NOT directly used from p_query_criteria for the main distribution,
    -- but we will construct a specific condition for actionable_count.

    -- Date related variables (copied from get_study_set_card_count)
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
    v_actionable_srs_condition TEXT; -- For the 'new_review' filter for actionable_count

    -- Temporary variables for initial distribution calculation
    DECLARE
        temp_new_count INTEGER;
        temp_learning_count INTEGER;
        temp_relearning_count INTEGER;
        temp_young_count INTEGER;
        temp_mature_count INTEGER;
        total_cards_in_filtered_set INTEGER;
BEGIN
    RAISE LOG '[get_study_set_srs_distribution_v2] User: %, Criteria: %', p_user_id, p_query_criteria;

    -- Initial WHERE clause for user_id
    v_where_clauses := array_append(v_where_clauses, format('c.user_id = %L', p_user_id));

    -- ========= BEGIN CRITERIA PARSING AND WHERE CLAUSE CONSTRUCTION (Largely from get_study_set_card_count) =========
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
                -- Tags are included, so 'd_tags_incl' alias for decks is already joined by the tag filtering logic.
                v_deck_alias_for_lang := 'd_tags_incl';
            ELSE
                -- No tags included. Add a new join for language filter with alias 'd_lang'.
                -- Ensure this specific join isn't redundantly added if it somehow existed from other logic (unlikely here).
                IF v_join_clauses !~ 'JOIN public.decks d_lang ON c.deck_id = d_lang.id' THEN
                    v_join_clauses := v_join_clauses || ' JOIN public.decks d_lang ON c.deck_id = d_lang.id';
                END IF;
                v_deck_alias_for_lang := 'd_lang';
            END IF;

            v_where_clauses := array_append(v_where_clauses,
                format('(%s.primary_language = %L OR (%s.is_bilingual IS TRUE AND %s.secondary_language = %L))',
                       v_deck_alias_for_lang, v_contains_language, v_deck_alias_for_lang, v_deck_alias_for_lang, v_contains_language)
            );
        END;
    END IF;

    -- Date Filters (copied and adapted)
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
        RAISE LOG '[get_study_set_srs_distribution_v2] allCards is true. Other filters like deckIds/tags will still apply if present in criteria.';
    END IF;
    -- ========= END CRITERIA PARSING AND WHERE CLAUSE CONSTRUCTION =========

    -- Fetch mature_interval_threshold from settings for the current user
    SELECT s.mature_interval_threshold INTO v_mature_threshold
    FROM public.settings s
    WHERE s.user_id = p_user_id
    LIMIT 1;
    v_mature_threshold := COALESCE(v_mature_threshold, 21); -- Default if not found

    -- Construct the dynamic WHERE part from parsed criteria (common for all counts)
    IF array_length(v_where_clauses, 1) > 0 THEN
        v_dynamic_where_conditions := array_to_string(v_where_clauses, ' AND ');
    ELSE
        v_dynamic_where_conditions := 'TRUE'; 
    END IF;
    RAISE LOG '[GSSD_LOG] Initial v_dynamic_where_conditions (before srsFilter): %', v_dynamic_where_conditions;

    -- BEGIN: Restore srsFilter application to v_dynamic_where_conditions
    DECLARE
        v_srs_filter_criteria TEXT := p_query_criteria->>'srsFilter';
        v_srs_filter_clause TEXT := '';
    BEGIN
        RAISE LOG '[GSSD_LOG] srsFilter processing: v_srs_filter_criteria is "%".', COALESCE(v_srs_filter_criteria, 'NULL') ;
        IF v_srs_filter_criteria IS NOT NULL AND v_srs_filter_criteria <> 'all' AND v_srs_filter_criteria <> 'none' THEN
            IF v_srs_filter_criteria = 'new' THEN
                v_srs_filter_clause := '(c.srs_level = 0 AND c.learning_state IS NULL)'; -- Strictly new
            ELSIF v_srs_filter_criteria = 'learning' THEN -- UI "Learning / Relearning"
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
            RAISE LOG '[GSSD_LOG] Derived v_srs_filter_clause: %', v_srs_filter_clause;

            IF v_srs_filter_clause <> '' THEN
                IF v_dynamic_where_conditions = 'TRUE' THEN
                    v_dynamic_where_conditions := v_srs_filter_clause;
                ELSE
                    v_dynamic_where_conditions := v_dynamic_where_conditions || ' AND ' || v_srs_filter_clause; 
                END IF;
                RAISE LOG '[get_study_set_srs_distribution_v2] Applied srsFilter "%": to v_dynamic_where_conditions', v_srs_filter_criteria; -- Kept original log tag for consistency
            END IF;
        END IF;
    END;
    -- END: Restore srsFilter application to v_dynamic_where_conditions
    RAISE LOG '[GSSD_LOG] Final v_dynamic_where_conditions (after srsFilter): %', v_dynamic_where_conditions;

    -- Define v_actionable_srs_condition based on p_query_criteria->>'srsFilter'
    v_actionable_srs_condition := CASE p_query_criteria->>'srsFilter'
        WHEN 'new' THEN 'c.srs_level = 0' 
        WHEN 'learning' THEN '(c.learning_state = ''learning'' OR c.learning_state = ''relearning'')' 
        WHEN 'young' THEN format('(c.srs_level > 0 AND c.interval_days < %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'' AND c.next_review_due <= NOW())', v_mature_threshold)
        WHEN 'mature' THEN format('(c.srs_level > 0 AND c.interval_days >= %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'' AND c.next_review_due <= NOW())', v_mature_threshold)
        WHEN 'due' THEN '( ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = ''relearning'')) AND c.next_review_due <= NOW() )'
        WHEN 'new_review' THEN '( (c.srs_level = 0 AND c.learning_state IS NULL) OR (c.srs_level = 0 AND c.learning_state = ''learning'') OR ( ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = ''relearning'')) AND c.next_review_due <= NOW() ) )'
        ELSE '( (c.srs_level = 0 AND c.learning_state IS NULL) OR (c.srs_level = 0 AND c.learning_state = ''learning'') OR ( ((c.srs_level >= 1) OR (c.srs_level = 0 AND c.learning_state = ''relearning'')) AND c.next_review_due <= NOW() ) )'
    END;
    RAISE LOG '[GSSD_LOG] v_actionable_srs_condition set to: %s (for srsFilter: %s)', v_actionable_srs_condition, COALESCE(p_query_criteria->>'srsFilter', 'NULL/default');
    
    -- Main SQL to get SRS distribution counts and total card count for the filtered set
    RAISE LOG '[GSSD_LOG] Formatting v_base_sql with: FROM=[%], JOIN=[%], WHERE=[%]', v_from_clause, COALESCE(v_join_clauses, 'EMPTY'), v_dynamic_where_conditions;
    v_base_sql := format(
        'SELECT ' ||
        '   COALESCE(SUM(CASE WHEN c.srs_level = 0 THEN 1 ELSE 0 END), 0)::BIGINT AS new_count, ' ||
        '   COALESCE(SUM(CASE WHEN c.learning_state = ''learning'' THEN 1 ELSE 0 END), 0)::BIGINT AS learning_count, ' ||
        '   COALESCE(SUM(CASE WHEN c.learning_state = ''relearning'' THEN 1 ELSE 0 END), 0)::BIGINT AS relearning_count, ' ||
        '   COALESCE(SUM(CASE WHEN c.srs_level > 0 AND c.interval_days < %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'' THEN 1 ELSE 0 END), 0)::BIGINT AS young_count, ' ||
        '   COALESCE(SUM(CASE WHEN c.srs_level > 0 AND c.interval_days >= %s AND c.learning_state IS DISTINCT FROM ''learning'' AND c.learning_state IS DISTINCT FROM ''relearning'' THEN 1 ELSE 0 END), 0)::BIGINT AS mature_count, ' ||
        '   COALESCE(COUNT(*), 0)::BIGINT AS total_for_set ' ||
        '%s %s WHERE %s',
        v_mature_threshold, v_mature_threshold, v_from_clause, v_join_clauses, v_dynamic_where_conditions
    );
    RAISE LOG '[get_study_set_srs_distribution_v2] Final SQL for distribution counts: %', v_base_sql; -- Kept original log tag

    EXECUTE v_base_sql
    INTO temp_new_count, temp_learning_count, temp_relearning_count, temp_young_count, temp_mature_count, total_cards_in_filtered_set;
    RAISE LOG '[GSSD_LOG] After EXECUTE v_base_sql: new=%, learn=%, relearn=%, young=%, mature=%, total_filtered=%',
        temp_new_count, temp_learning_count, temp_relearning_count, temp_young_count, temp_mature_count, total_cards_in_filtered_set;

    -- Conditionally populate the result based on p_srs_filter
    DECLARE
        v_srs_filter_val TEXT := p_query_criteria->>'srsFilter';
    BEGIN
        RAISE LOG '[GSSD_LOG] Conditional distribution: v_srs_filter_val is "%".', COALESCE(v_srs_filter_val, 'NULL');
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
        RAISE LOG '[GSSD_LOG] v_distribution_result after conditional assignment: new=%, learn=%, relearn=%, young=%, mature=%',
            v_distribution_result.new_count, v_distribution_result.learning_count, v_distribution_result.relearning_count, v_distribution_result.young_count, v_distribution_result.mature_count;
    END;

    -- Calculate actionable_count 
    DECLARE
        v_srs_filter_for_actionable TEXT := p_query_criteria->>'srsFilter';
    BEGIN
        RAISE LOG '[GSSD_LOG] Actionable count calc: v_srs_filter_for_actionable is "%".', COALESCE(v_srs_filter_for_actionable, 'NULL');
        IF v_srs_filter_for_actionable = 'new' OR v_srs_filter_for_actionable = 'learning' THEN
            v_distribution_result.actionable_count = total_cards_in_filtered_set;
            RAISE LOG '[get_study_set_srs_distribution_v2] Actionable count for srsFilter "%": set to total_cards_in_filtered_set (%s)', 
                v_srs_filter_for_actionable, total_cards_in_filtered_set; -- Kept original log tag
        ELSE
            RAISE LOG '[get_study_set_srs_distribution_v2] Calculating actionable_count for srsFilter "%" using condition: %s', 
                COALESCE(v_srs_filter_for_actionable, 'default'), 
                v_actionable_srs_condition; -- Kept original log tag
            
            EXECUTE format(
                'SELECT COALESCE(COUNT(*), 0)::BIGINT
                 FROM public.cards c %s 
                 WHERE (%s) AND (%s)',
                v_join_clauses,             -- joins
                v_dynamic_where_conditions, -- main filters including srsFilter
                v_actionable_srs_condition  -- specific actionable condition for the srsFilter type
            )
            INTO v_distribution_result.actionable_count;
        END IF;
        RAISE LOG '[GSSD_LOG] Final actionable_count: %', v_distribution_result.actionable_count;
    END;

    RETURN v_distribution_result;

EXCEPTION WHEN others THEN
    RAISE WARNING '[get_study_set_srs_distribution_v2] Error for User: %, Criteria: %. Error: %', p_user_id, p_query_criteria, SQLERRM;
    RETURN (0,0,0,0,0,0)::public.srs_distribution_counts; -- Return zero counts on error, including new field
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_study_set_srs_distribution(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.get_study_set_srs_distribution(uuid, jsonb) IS
'Calculates the distribution of cards across SRS stages (new, learning, relearning, young, mature) AND an actionable count (new/review) for a given study set criteria. v2.'; 