-- ============================================
-- إصلاح جدول طلبات العملاء (Client Intake)
-- ============================================
-- نفذ هذا في Supabase SQL Editor

-- 1. إنشاء جدول طلبات العملاء
CREATE TABLE IF NOT EXISTS client_intake_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    client_email TEXT,
    event_details JSONB,
    guest_list_url TEXT,
    ai_analysis JSONB,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. إنشاء Storage Bucket للملفات
INSERT INTO storage.buckets (id, name, public)
VALUES ('intake_files', 'intake_files', true)
ON CONFLICT (id) DO NOTHING;

-- 3. سياسات الأمان للجدول
-- السماح للجميع بالإضافة (للعملاء الجدد)
CREATE POLICY "Allow public insert"
ON client_intake_requests
FOR INSERT
TO public
WITH CHECK (true);

-- السماح بالقراءة للمسؤولين فقط (يمكن تعديله لاحقاً)
CREATE POLICY "Allow authenticated read"
ON client_intake_requests
FOR SELECT
TO authenticated
USING (true);

-- السماح بالتحديث للمسؤولين
CREATE POLICY "Allow authenticated update"
ON client_intake_requests
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. سياسات Storage
-- السماح للجميع برفع الملفات
CREATE POLICY "Allow public upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'intake_files');

-- السماح للجميع بقراءة الملفات (الـ bucket عام)
CREATE POLICY "Allow public read files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'intake_files');

-- 5. إنشاء indexes للأداء
CREATE INDEX IF NOT EXISTS idx_intake_status 
ON client_intake_requests(status);

CREATE INDEX IF NOT EXISTS idx_intake_created 
ON client_intake_requests(created_at DESC);

-- 6. بيانات تجريبية (اختياري للاختبار)
INSERT INTO client_intake_requests (
    client_name,
    client_phone,
    client_email,
    event_details,
    ai_analysis,
    status
) VALUES (
    'أحمد محمد - تجريبي',
    '0501234567',
    'test@example.com',
    '{"title": "حفل زفاف تجريبي", "date": "2025-01-15", "location": "قاعة الفخامة", "type": "wedding", "notes": "بيانات تجريبية"}',
    '[{"name": "ضيف تجريبي 1", "phone": "+966501234567", "companions_count": 2}, {"name": "ضيف تجريبي 2", "phone": "+966509876543", "companions_count": 0}]',
    'new'
);

-- ✅ تم! الآن جرب رفع طلب من /intake
