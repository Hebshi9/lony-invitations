-- ======================================================
-- إصلاح Storage RLS + جعل الباكت public
-- نفّذ هذا في Supabase SQL Editor
-- ======================================================

-- 1. global-invitations bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('global-invitations', 'global-invitations', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. سياسات التخزين
DROP POLICY IF EXISTS "public_upload_global" ON storage.objects;
CREATE POLICY "public_upload_global" ON storage.objects
FOR ALL TO public USING (bucket_id = 'global-invitations')
WITH CHECK (bucket_id = 'global-invitations');

-- 3. invitation-cards bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('invitation-cards', 'invitation-cards', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public_all_cards" ON storage.objects;
CREATE POLICY "public_all_cards" ON storage.objects
FOR ALL TO public USING (bucket_id = 'invitation-cards')
WITH CHECK (bucket_id = 'invitation-cards');
