-- Add optional watermark_type column to decks table
-- NULL means auto-detect from title/tags (current behavior)
-- A value like 'math', 'science', etc. overrides auto-detection
ALTER TABLE decks ADD COLUMN IF NOT EXISTS watermark_type text DEFAULT NULL;

-- Update the RPC function to include watermark_type in results
CREATE OR REPLACE FUNCTION get_deck_list_with_srs_counts(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    primary_language text,
    secondary_language text,
    is_bilingual boolean,
    updated_at timestamptz,
    watermark_type text,
    deck_tags_json jsonb,
    new_count bigint,
    learning_count bigint,
    relearning_count bigint,
    young_count bigint,
    mature_count bigint,
    learn_eligible_count bigint,
    review_eligible_count bigint
) LANGUAGE sql STABLE AS $$
    SELECT
        d.id,
        d.name,
        d.primary_language,
        d.secondary_language,
        d.is_bilingual,
        d.updated_at,
        d.watermark_type,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name))
             FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id
             WHERE dt.deck_id = d.id AND dt.user_id = p_user_id),
            '[]'::jsonb
        ) AS deck_tags_json,
        COUNT(*) FILTER (WHERE c.srs_level = 0) AS new_count,
        COUNT(*) FILTER (WHERE c.srs_level = 1) AS learning_count,
        COUNT(*) FILTER (WHERE c.srs_level = 2) AS relearning_count,
        COUNT(*) FILTER (WHERE c.srs_level = 3) AS young_count,
        COUNT(*) FILTER (WHERE c.srs_level = 4) AS mature_count,
        COUNT(*) FILTER (WHERE c.srs_level = 0 OR (c.srs_level = 1 AND c.next_review_at <= now())) AS learn_eligible_count,
        COUNT(*) FILTER (WHERE c.srs_level >= 2 AND c.next_review_at <= now()) AS review_eligible_count
    FROM decks d
    LEFT JOIN cards c ON c.deck_id = d.id
    WHERE d.user_id = p_user_id AND d.status = 'active'
    GROUP BY d.id
    ORDER BY d.updated_at DESC NULLS LAST;
$$;

-- Also update management RPC if it exists
CREATE OR REPLACE FUNCTION get_deck_list_for_management(p_user_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    primary_language text,
    secondary_language text,
    is_bilingual boolean,
    updated_at timestamptz,
    status text,
    watermark_type text,
    deck_tags_json jsonb,
    new_count bigint,
    learning_count bigint,
    relearning_count bigint,
    young_count bigint,
    mature_count bigint,
    learn_eligible_count bigint,
    review_eligible_count bigint
) LANGUAGE sql STABLE AS $$
    SELECT
        d.id,
        d.name,
        d.primary_language,
        d.secondary_language,
        d.is_bilingual,
        d.updated_at,
        d.status::text,
        d.watermark_type,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name))
             FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id
             WHERE dt.deck_id = d.id AND dt.user_id = p_user_id),
            '[]'::jsonb
        ) AS deck_tags_json,
        COUNT(*) FILTER (WHERE c.srs_level = 0) AS new_count,
        COUNT(*) FILTER (WHERE c.srs_level = 1) AS learning_count,
        COUNT(*) FILTER (WHERE c.srs_level = 2) AS relearning_count,
        COUNT(*) FILTER (WHERE c.srs_level = 3) AS young_count,
        COUNT(*) FILTER (WHERE c.srs_level = 4) AS mature_count,
        COUNT(*) FILTER (WHERE c.srs_level = 0 OR (c.srs_level = 1 AND c.next_review_at <= now())) AS learn_eligible_count,
        COUNT(*) FILTER (WHERE c.srs_level >= 2 AND c.next_review_at <= now()) AS review_eligible_count
    FROM decks d
    LEFT JOIN cards c ON c.deck_id = d.id
    WHERE d.user_id = p_user_id
    GROUP BY d.id
    ORDER BY d.updated_at DESC NULLS LAST;
$$;
