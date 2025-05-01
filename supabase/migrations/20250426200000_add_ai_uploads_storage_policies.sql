-- supabase/migrations/add_ai_uploads_storage_policies.sql
-- Migration to add Row Level Security (RLS) policies for the 'ai-uploads' storage bucket.
-- These policies restrict access based on authenticated user ID matching the first part of the file path.
-- Uses DROP IF EXISTS / CREATE to ensure idempotency on older PostgreSQL versions.

-- 1. Policy: Allow authenticated users to upload (INSERT) files into their own folder.
DROP POLICY IF EXISTS "Allow authenticated uploads to own folder" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to own folder" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'ai-uploads' AND 
  auth.uid() = ((storage.foldername(name))[1])::uuid -- Cast text folder name to uuid
);

-- 2. Policy: Allow authenticated users to download/view (SELECT) files from their own folder.
DROP POLICY IF EXISTS "Allow authenticated selects from own folder" ON storage.objects;
CREATE POLICY "Allow authenticated selects from own folder" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'ai-uploads' AND 
  auth.uid() = ((storage.foldername(name))[1])::uuid -- Cast text folder name to uuid
);

-- 3. Policy: Allow authenticated users to delete (DELETE) files from their own folder.
DROP POLICY IF EXISTS "Allow authenticated deletes from own folder" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from own folder" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'ai-uploads' AND 
  auth.uid() = ((storage.foldername(name))[1])::uuid -- Cast text folder name to uuid
);

-- 4. Policy: Allow authenticated users to update (UPDATE) files in their own folder.
DROP POLICY IF EXISTS "Allow authenticated updates in own folder" ON storage.objects;
CREATE POLICY "Allow authenticated updates in own folder" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'ai-uploads' AND 
  auth.uid() = ((storage.foldername(name))[1])::uuid -- Cast text folder name to uuid
);

-- Optional: Log the creation of policies (informational)
-- INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('add_ai_uploads_storage_policies');
-- Note: Supabase CLI handles migration versioning automatically. 