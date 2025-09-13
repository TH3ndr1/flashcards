-- Enable real-time subscriptions for decks table
-- This allows clients to receive real-time updates when decks are created, updated, or deleted

BEGIN;

-- Add decks table to the supabase_realtime publication
-- This enables real-time subscriptions for the decks table
ALTER PUBLICATION supabase_realtime ADD TABLE decks;

-- Ensure RLS is properly configured for real-time access
-- Users should only receive updates for their own decks
DO $$
BEGIN
  -- Check if RLS policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'decks' 
    AND policyname = 'Users can view own decks'
  ) THEN
    CREATE POLICY "Users can view own decks" ON "public"."decks"
      AS PERMISSIVE FOR SELECT
      TO public
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
