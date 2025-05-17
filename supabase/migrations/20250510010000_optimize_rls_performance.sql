-- migrate:up
-- Optimize RLS policy performance by reducing function calls
-- Based on Supabase Performance Advisor recommendations

-- First drop all existing policies
DROP POLICY IF EXISTS "Users can only access cards in their decks" ON public.cards;
DROP POLICY IF EXISTS "Allow users to DELETE their own deck_tags" ON public.deck_tags;
DROP POLICY IF EXISTS "Allow users to INSERT deck_tags for their own decks" ON public.deck_tags;
DROP POLICY IF EXISTS "Allow users to SELECT their own deck_tags" ON public.deck_tags;
DROP POLICY IF EXISTS "Users can only access their own decks" ON public.decks;
DROP POLICY IF EXISTS "Allow individual user access to their settings" ON public.settings;
DROP POLICY IF EXISTS "Users can only access their own settings" ON public.settings;
DROP POLICY IF EXISTS "Allow individual user access to their study_sets" ON public.study_sets;
DROP POLICY IF EXISTS "Allow individual user access to their tags" ON public.tags;

-- Recreate policies with optimized (SELECT auth.uid() AS uid) form
CREATE POLICY "Users can only access cards in their decks" 
ON public.cards 
FOR ALL
TO public
USING (
    EXISTS (
        SELECT 1
        FROM decks
        WHERE decks.id = cards.deck_id 
        AND decks.user_id = (SELECT auth.uid() AS uid)
    )
);

CREATE POLICY "Allow users to DELETE their own deck_tags"
ON public.deck_tags
FOR DELETE
TO public
USING (user_id = (SELECT auth.uid() AS uid));

CREATE POLICY "Allow users to INSERT deck_tags for their own decks"
ON public.deck_tags
FOR INSERT
TO public
WITH CHECK (
    (user_id = (SELECT auth.uid() AS uid)) AND 
    (EXISTS (
        SELECT 1
        FROM decks
        WHERE decks.id = deck_tags.deck_id 
        AND decks.user_id = (SELECT auth.uid() AS uid)
    )) AND 
    (EXISTS (
        SELECT 1
        FROM tags
        WHERE tags.id = deck_tags.tag_id 
        AND tags.user_id = (SELECT auth.uid() AS uid)
    ))
);

CREATE POLICY "Allow users to SELECT their own deck_tags"
ON public.deck_tags
FOR SELECT
TO public
USING (user_id = (SELECT auth.uid() AS uid));

CREATE POLICY "Users can only access their own decks" 
ON public.decks 
FOR ALL
TO public
USING (user_id = (SELECT auth.uid() AS uid));

CREATE POLICY "Allow individual user access to their settings" 
ON public.settings 
FOR ALL
TO public
USING (user_id = (SELECT auth.uid() AS uid));

CREATE POLICY "Users can only access their own settings" 
ON public.settings 
FOR ALL
TO public
USING (user_id = (SELECT auth.uid() AS uid));

CREATE POLICY "Allow individual user access to their study_sets" 
ON public.study_sets 
FOR ALL
TO public
USING (user_id = (SELECT auth.uid() AS uid));

CREATE POLICY "Allow individual user access to their tags" 
ON public.tags 
FOR ALL
TO public
USING (user_id = (SELECT auth.uid() AS uid));

-- migrate:down
-- Revert to original policies
DROP POLICY IF EXISTS "Users can only access cards in their decks" ON public.cards;
DROP POLICY IF EXISTS "Allow users to DELETE their own deck_tags" ON public.deck_tags;
DROP POLICY IF EXISTS "Allow users to INSERT deck_tags for their own decks" ON public.deck_tags;
DROP POLICY IF EXISTS "Allow users to SELECT their own deck_tags" ON public.deck_tags;
DROP POLICY IF EXISTS "Users can only access their own decks" ON public.decks;
DROP POLICY IF EXISTS "Allow individual user access to their settings" ON public.settings;
DROP POLICY IF EXISTS "Users can only access their own settings" ON public.settings;
DROP POLICY IF EXISTS "Allow individual user access to their study_sets" ON public.study_sets;
DROP POLICY IF EXISTS "Allow individual user access to their tags" ON public.tags;

-- Restore original cards policy
CREATE POLICY "Users can only access cards in their decks"
ON public.cards
FOR ALL
TO public
USING (
    EXISTS (
        SELECT 1
        FROM decks
        WHERE decks.id = cards.deck_id 
        AND decks.user_id = auth.uid()
    )
);

-- Restore original deck_tags policies
CREATE POLICY "Allow users to DELETE their own deck_tags"
ON public.deck_tags
FOR DELETE
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Allow users to INSERT deck_tags for their own decks"
ON public.deck_tags
FOR INSERT
TO public
WITH CHECK (
    (auth.uid() = user_id) AND 
    (EXISTS (
        SELECT 1
        FROM decks
        WHERE decks.id = deck_tags.deck_id 
        AND decks.user_id = auth.uid()
    )) AND 
    (EXISTS (
        SELECT 1
        FROM tags
        WHERE tags.id = deck_tags.tag_id 
        AND tags.user_id = auth.uid()
    ))
);

CREATE POLICY "Allow users to SELECT their own deck_tags"
ON public.deck_tags
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- Restore original decks policy
CREATE POLICY "Users can only access their own decks"
ON public.decks
FOR ALL
TO public
USING (auth.uid() = user_id);

-- Restore original settings policies
CREATE POLICY "Allow individual user access to their settings"
ON public.settings
FOR ALL
TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own settings"
ON public.settings
FOR ALL
TO public
USING (auth.uid() = user_id);

-- Restore original study_sets policy
CREATE POLICY "Allow individual user access to their study_sets"
ON public.study_sets
FOR ALL
TO public
USING (auth.uid() = user_id);

-- Restore original tags policy
CREATE POLICY "Allow individual user access to their tags"
ON public.tags
FOR ALL
TO public
USING (auth.uid() = user_id); 