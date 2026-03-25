-- Create stories table for caching AI-generated deck stories
CREATE TABLE IF NOT EXISTS stories (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id             UUID NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  age_at_generation   INTEGER NOT NULL,
  reading_time_min    INTEGER NOT NULL CHECK (reading_time_min IN (5, 10, 20)),
  cards_hash          TEXT NOT NULL,
  deck_mode           TEXT NOT NULL CHECK (deck_mode IN ('knowledge', 'translation')),
  paragraphs          JSONB NOT NULL DEFAULT '[]',
  is_manually_edited  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

-- Users can only access their own stories
CREATE POLICY "Users can only access their own stories"
  ON stories FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for fast lookups by deck + user
CREATE INDEX IF NOT EXISTS stories_deck_user_idx ON stories(deck_id, user_id);
