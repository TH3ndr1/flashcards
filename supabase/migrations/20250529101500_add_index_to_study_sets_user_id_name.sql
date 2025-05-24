-- Migration: Add index to study_sets table on user_id and name
-- Version: 1
-- Description: This migration creates a non-unique btree index on the public.study_sets table 
--              for the user_id and name columns to improve query performance, 
--              particularly for fetching and sorting user-specific study sets.

CREATE INDEX IF NOT EXISTS idx_study_sets_user_id_name 
ON public.study_sets USING btree (user_id, name);

COMMENT ON INDEX idx_study_sets_user_id_name IS 'Index to speed up fetching study sets for a user, ordered by name.'; 