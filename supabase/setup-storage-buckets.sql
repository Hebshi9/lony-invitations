-- ══════════════════════════════════════════════════════════
--  Supabase Storage Setup for Invitation Studio
--  شغّل هذا في Supabase SQL Editor
--  (أو في Dashboard > Storage — أنشئ bucket يدوياً)
-- ══════════════════════════════════════════════════════════

-- 1. Create the invitation-cards bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'invitation-cards',
    'invitation-cards',
    true,           -- Public bucket (anyone can view URLs)
    10485760,       -- 10 MB per file limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760;

-- 2. Storage Policies — Allow authenticated users to upload
CREATE POLICY "Allow authenticated upload to invitation-cards"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invitation-cards');

CREATE POLICY "Allow authenticated update of invitation-cards"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invitation-cards');

CREATE POLICY "Allow public read of invitation-cards"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invitation-cards');

CREATE POLICY "Allow authenticated delete from invitation-cards"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'invitation-cards');

-- 3. Also ensure 'invitations' bucket exists (fallback)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invitations', 'invitations', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Allow authenticated upload to invitations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invitations');

CREATE POLICY "Allow public read of invitations"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invitations');
