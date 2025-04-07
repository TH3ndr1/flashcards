-- Ensure the required extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add the default value generator to the id column
ALTER TABLE public.cards
ALTER COLUMN id SET DEFAULT uuid_generate_v4();