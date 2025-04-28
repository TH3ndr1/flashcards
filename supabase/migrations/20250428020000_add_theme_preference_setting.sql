-- Migration: Add theme_light_dark_mode setting

ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS theme_light_dark_mode TEXT NOT NULL DEFAULT 'system';
-- Optional: Add a check constraint
-- ALTER TABLE public.settings
-- ADD CONSTRAINT valid_theme_light_dark_mode CHECK (theme_light_dark_mode IN ('light', 'dark', 'system'));

COMMENT ON COLUMN public.settings.theme_light_dark_mode IS 'User preferred theme (light, dark, system).'; 