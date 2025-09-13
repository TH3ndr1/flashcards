-- Create status_type enum for decks and cards
CREATE TYPE "public"."status_type" AS ENUM ('active', 'archived', 'deleted');

-- Add status column to decks table
ALTER TABLE "public"."decks" ADD COLUMN IF NOT EXISTS "status" status_type NOT NULL DEFAULT 'active';

-- Add status column to cards table  
ALTER TABLE "public"."cards" ADD COLUMN IF NOT EXISTS "status" status_type NOT NULL DEFAULT 'active';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_decks_status" ON "public"."decks" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_cards_status" ON "public"."cards" USING btree ("status");
CREATE INDEX IF NOT EXISTS "idx_decks_user_id_status" ON "public"."decks" USING btree ("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_cards_user_id_status" ON "public"."cards" USING btree ("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_cards_deck_id_status" ON "public"."cards" USING btree ("deck_id", "status");

-- Add comments for documentation
COMMENT ON COLUMN "public"."decks"."status" IS 'Status of the deck: active (default), archived, or deleted';
COMMENT ON COLUMN "public"."cards"."status" IS 'Status of the card: active (default), archived, or deleted';
