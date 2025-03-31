-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the 'settings' table
CREATE TABLE IF NOT EXISTS public.settings (
    user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    srs_algorithm text NOT NULL DEFAULT 'sm2'::text CHECK (srs_algorithm IN ('sm2', 'fsrs')),
    fsrs_parameters jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    tts_enabled boolean NULL,
    card_font text NULL
);

-- RLS Policy: Users can only manage/view their own settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow individual user access to their settings"
ON public.settings
FOR ALL USING (auth.uid() = user_id);


-- 2. Create the 'tags' table
CREATE TABLE IF NOT EXISTS public.tags (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tags_user_id_name_key UNIQUE (user_id, name)
);

-- RLS Policy: Users can only manage/view their own tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow individual user access to their tags"
ON public.tags
FOR ALL USING (auth.uid() = user_id);


-- 3. Add SRS fields to the 'cards' table if they don't exist
DO $$ 
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'user_id') THEN
        ALTER TABLE public.cards ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'last_reviewed_at') THEN
        ALTER TABLE public.cards ADD COLUMN last_reviewed_at timestamptz NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'next_review_due') THEN
        ALTER TABLE public.cards ADD COLUMN next_review_due timestamptz NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'srs_level') THEN
        ALTER TABLE public.cards ADD COLUMN srs_level integer NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'easiness_factor') THEN
        ALTER TABLE public.cards ADD COLUMN easiness_factor float NULL DEFAULT 2.5;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'interval_days') THEN
        ALTER TABLE public.cards ADD COLUMN interval_days integer NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'stability') THEN
        ALTER TABLE public.cards ADD COLUMN stability float NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'difficulty') THEN
        ALTER TABLE public.cards ADD COLUMN difficulty float NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'last_review_grade') THEN
        ALTER TABLE public.cards ADD COLUMN last_review_grade integer NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'correct_count') THEN
        ALTER TABLE public.cards ADD COLUMN correct_count integer NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cards' AND column_name = 'incorrect_count') THEN
        ALTER TABLE public.cards ADD COLUMN incorrect_count integer NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add index for efficient querying of due cards per user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'cards' 
        AND indexname = 'idx_cards_user_id_next_review_due'
    ) THEN
        CREATE INDEX idx_cards_user_id_next_review_due ON public.cards (user_id, next_review_due);
    END IF;
END $$;

-- RLS Policy update (Conceptual): Ensure existing policy includes user_id check
-- Example: If policy was just based on deck_id, update it.
-- ALTER POLICY "Allow individual user access" ON public.cards
-- USING (auth.uid() = user_id); -- Or using a check through the deck table if user_id wasn't added


-- 4. Create the 'card_tags' join table
CREATE TABLE IF NOT EXISTS public.card_tags (
    card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT card_tags_pkey PRIMARY KEY (card_id, tag_id)
);

-- RLS Policy: Users can only manage/view their own card-tag links
ALTER TABLE public.card_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow individual user access to their card_tags"
ON public.card_tags
FOR ALL USING (auth.uid() = user_id);


-- 5. Create the 'study_sets' table
CREATE TABLE IF NOT EXISTS public.study_sets (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NULL,
    query_criteria jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS Policy: Users can only manage/view their own study sets
ALTER TABLE public.study_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow individual user access to their study_sets"
ON public.study_sets
FOR ALL USING (auth.uid() = user_id);

-- Create or update trigger function for updating 'updated_at' columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with 'updated_at'
DO $$
BEGIN
    -- Drop existing triggers if they exist
    DROP TRIGGER IF EXISTS set_settings_updated_at ON public.settings;
    DROP TRIGGER IF EXISTS set_cards_updated_at ON public.cards;
    DROP TRIGGER IF EXISTS set_study_sets_updated_at ON public.study_sets;
    
    -- Create new triggers
    CREATE TRIGGER set_settings_updated_at
        BEFORE UPDATE ON public.settings
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    
    CREATE TRIGGER set_cards_updated_at
        BEFORE UPDATE ON public.cards
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    
    CREATE TRIGGER set_study_sets_updated_at
        BEFORE UPDATE ON public.study_sets
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
END $$;

-- Note: Decks table already exists, but ensure it has user_id and potentially updated_at trigger if needed.
-- Ensure RLS policies are comprehensive and cover all access patterns. 