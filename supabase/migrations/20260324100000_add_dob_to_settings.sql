-- Add date_of_birth column to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS date_of_birth DATE;
