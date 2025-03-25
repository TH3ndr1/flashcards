-- Create users table (handled by Supabase Auth)

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_language TEXT NOT NULL DEFAULT 'english',
  preferred_voices JSONB NOT NULL DEFAULT '{"english": null, "dutch": null, "french": null}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create decks table
CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'english',
  progress JSONB NOT NULL DEFAULT '{"correct": 0, "total": 0}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  correct_count INTEGER NOT NULL DEFAULT 0,
  incorrect_count INTEGER NOT NULL DEFAULT 0,
  last_studied TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);

-- Create RLS policies
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Settings policies
CREATE POLICY settings_select ON settings FOR SELECT
  USING (auth.uid() = user_id);
  
CREATE POLICY settings_insert ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY settings_update ON settings FOR UPDATE
  USING (auth.uid() = user_id);
  
CREATE POLICY settings_delete ON settings FOR DELETE
  USING (auth.uid() = user_id);

-- Decks policies
CREATE POLICY decks_select ON decks FOR SELECT
  USING (auth.uid() = user_id);
  
CREATE POLICY decks_insert ON decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY decks_update ON decks FOR UPDATE
  USING (auth.uid() = user_id);
  
CREATE POLICY decks_delete ON decks FOR DELETE
  USING (auth.uid() = user_id);

-- Cards policies
CREATE POLICY cards_select ON cards FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  ));
  
CREATE POLICY cards_insert ON cards FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  ));
  
CREATE POLICY cards_update ON cards FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  ));
  
CREATE POLICY cards_delete ON cards FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  ));

