-- migrate:up
-- Add kid-friendly SRS settings to persist per user
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS first_review_base_days INTEGER NOT NULL DEFAULT 4;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS early_review_max_days INTEGER NOT NULL DEFAULT 14;

COMMENT ON COLUMN public.settings.first_review_base_days IS 'Base days used for the first review interval (level 1 -> 2).';
COMMENT ON COLUMN public.settings.early_review_max_days IS 'Maximum interval (days) allowed while srs_level <= 3.';

-- migrate:down
-- Revert the added settings columns
ALTER TABLE public.settings
  DROP COLUMN IF EXISTS early_review_max_days;

ALTER TABLE public.settings
  DROP COLUMN IF EXISTS first_review_base_days;


