-- Add pdf_font column to settings table
-- Allows users to choose a separate font for PDF exports,
-- independent of the card appearance font.

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS pdf_font TEXT NOT NULL DEFAULT 'default';

COMMENT ON COLUMN public.settings.pdf_font IS 'Font used for PDF exports (default, atkinson, opendyslexic). Default: default (Helvetica).';
