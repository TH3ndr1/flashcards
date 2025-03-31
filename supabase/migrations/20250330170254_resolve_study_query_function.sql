-- Create a function to resolve study query criteria into a list of card IDs
create or replace function resolve_study_query(
    p_user_id uuid,                    -- The user making the request
    p_criteria jsonb                   -- The study query criteria
)
returns table (
    card_id uuid,                      -- The ID of each matching card
    priority integer                   -- Priority for ordering (lower = higher priority)
)
language plpgsql
security definer                       -- Run as owner for better performance
set search_path = public              -- Security: explicitly set search path
as $$
declare
    v_deck_id uuid;
    v_study_set_id uuid;
    v_tag_ids uuid[];
    v_limit integer;
    v_include_new boolean;
    v_include_review boolean;
    v_include_learning boolean;
begin
    -- Extract criteria parameters with defaults
    v_deck_id := (p_criteria->>'deckId')::uuid;
    v_study_set_id := (p_criteria->>'studySetId')::uuid;
    v_tag_ids := array(select jsonb_array_elements_text(p_criteria->'tagIds')::uuid);
    v_limit := coalesce((p_criteria->>'limit')::integer, 50);
    v_include_new := coalesce((p_criteria->>'includeNew')::boolean, true);
    v_include_review := coalesce((p_criteria->>'includeReview')::boolean, true);
    v_include_learning := coalesce((p_criteria->>'includeLearning')::boolean, true);

    return query
    with user_cards as (
        -- Start with cards the user has access to through their decks
        select c.id, c.deck_id, c.last_studied, c.attempt_count
        from cards c
        join decks d on d.id = c.deck_id
        where d.user_id = p_user_id
        and (v_deck_id is null or c.deck_id = v_deck_id)
    ),
    tagged_cards as (
        -- Filter by tags if specified
        select distinct uc.*
        from user_cards uc
        left join card_tags ct on ct.card_id = uc.id
        where array_length(v_tag_ids, 1) is null  -- No tag filter
        or ct.tag_id = any(v_tag_ids)
    ),
    study_set_cards as (
        -- Filter by study set if specified
        select tc.*
        from tagged_cards tc
        where v_study_set_id is null  -- No study set filter
        or exists (
            select 1
            from study_sets ss
            where ss.id = v_study_set_id
            and ss.user_id = p_user_id
            -- TODO: Add study set query criteria evaluation here
        )
    ),
    categorized_cards as (
        -- Categorize cards by their study state
        select 
            id as card_id,
            case
                when attempt_count = 0 then 'new'
                when last_studied is not null and last_studied <= now() - interval '1 day' then 'review'
                else 'learning'
            end as study_state,
            case
                when attempt_count = 0 then 1  -- New cards
                when last_studied is not null and last_studied <= now() - interval '1 day' then 3  -- Review cards due
                else 2  -- Learning cards
            end as priority
        from study_set_cards
    )
    select 
        cc.card_id,
        cc.priority
    from categorized_cards cc
    where (
        (cc.study_state = 'new' and v_include_new) or
        (cc.study_state = 'learning' and v_include_learning) or
        (cc.study_state = 'review' and v_include_review)
    )
    order by cc.priority, random()  -- Randomize within priority groups
    limit v_limit;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function resolve_study_query(uuid, jsonb) to authenticated;

-- Add comment explaining the function
comment on function resolve_study_query(uuid, jsonb) is 
'Resolves a study query criteria into a prioritized list of card IDs for study.
Takes user_id and a JSONB criteria object containing:
- deckId: UUID (optional) - Limit to specific deck
- studySetId: UUID (optional) - Limit to specific study set
- tagIds: UUID[] (optional) - Limit to cards with these tags
- limit: integer (default: 50) - Maximum number of cards to return
- includeNew: boolean (default: true) - Include new cards
- includeReview: boolean (default: true) - Include review cards
- includeLearning: boolean (default: true) - Include learning cards

Returns: table(card_id uuid, priority integer)
where priority is 1-4 (lower = higher priority):
1 = new cards (attempt_count = 0)
2 = learning cards (has been studied but not due for review)
3 = review cards (last_studied > 1 day ago)
4 = cards not yet due';
