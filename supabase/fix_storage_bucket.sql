-- Create invitation-cards bucket if it doesn't exist
-- Run this in Supabase SQL Editor

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('invitation-cards', 'invitation-cards', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public access to read files
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'invitation-cards');

-- 3. Allow authenticated users to upload
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invitation-cards' AND auth.role() = 'authenticated');

-- 4. Allow authenticated users to update
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'invitation-cards' AND auth.role() = 'authenticated');

-- 5. Allow authenticated users to delete
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'invitation-cards' AND auth.role() = 'authenticated');

-- 6. IMPORTANT: Allow ANON users to upload (for development)
-- Remove this in production!
DROP POLICY IF EXISTS "Allow anon upload for development" ON storage.objects;
CREATE POLICY "Allow anon upload for development"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'invitation-cards');

DROP POLICY IF EXISTS "Allow anon update for development" ON storage.objects;
CREATE POLICY "Allow anon update for development"
ON storage.objects FOR UPDATE
USING (bucket_id = 'invitation-cards');
