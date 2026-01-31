-- ============================================
-- ✅ الحل الشامل - نفذ هذا في Supabase SQL Editor
-- ============================================

-- 1️⃣ إنشاء Storage Bucket للملفات (CRITICAL!)
INSERT INTO storage.buckets (id, name, public)
VALUES ('intake_files', 'intake_files', true)
ON CONFLICT (id) DO NOTHING;

-- 2️⃣ إنشاء جدول طلبات العملاء
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

-- 3️⃣ تفعيل RLS
ALTER TABLE client_intake_requests ENABLE ROW LEVEL SECURITY;

-- 4️⃣ حذف السياسات القديمة (إن وجدت)
DROP POLICY IF EXISTS "Allow public insert" ON client_intake_requests;
DROP POLICY IF EXISTS "Allow authenticated read" ON client_intake_requests;
DROP POLICY IF EXISTS "Allow authenticated update" ON client_intake_requests;

-- 5️⃣ إنشاء سياسات جديدة للجدول
-- السماح للجميع بالإضافة (للعملاء الجدد)
CREATE POLICY "Allow public insert"
ON client_intake_requests
FOR INSERT
TO public
WITH CHECK (true);

-- السماح بالقراءة للمسؤولين
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

-- السماح بالحذف للمسؤولين (لحذف الطلبات التجريبية)
CREATE POLICY "Allow authenticated delete"
ON client_intake_requests
FOR DELETE
TO authenticated
USING (true);

-- 6️⃣ إنشاء دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_client_intake_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7️⃣ إنشاء Trigger لتحديث updated_at
DROP TRIGGER IF EXISTS set_updated_at ON client_intake_requests;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON client_intake_requests
FOR EACH ROW
EXECUTE FUNCTION update_client_intake_updated_at();

-- 8️⃣ حذف سياسات Storage القديمة
DROP POLICY IF EXISTS "Allow public upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read files" ON storage.objects;

-- 9️⃣ سياسات Storage للملفات
-- السماح للجميع برفع الملفات
CREATE POLICY "Allow public upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'intake_files');

-- السماح للجميع بقراءة الملفات
CREATE POLICY "Allow public read files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'intake_files');

-- 🔟 إنشاء Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_intake_status ON client_intake_requests(status);
CREATE INDEX IF NOT EXISTS idx_intake_created ON client_intake_requests(created_at DESC);

-- 1️⃣1️⃣ بيانات تجريبية (للتأكد أن كل شيء يعمل)
INSERT INTO client_intake_requests (
    client_name,
    client_phone,
    client_email,
    event_details,
    status
) VALUES (
    'اختبار - حذف لاحقاً',
    '0501234567',
    'test@test.com',
    '{"title": "اختبار", "date": "2025-01-01"}',
    'new'
) ON CONFLICT DO NOTHING;

-- ✅ تم! الآن:
-- 1. اذهب لـ Dashboard → طلبات العملاء
-- 2. يجب أن ترى طلب "اختبار - حذف لاحقاً"
-- 3. جرب رفع طلب جديد من /intake
-- 4. عند تحديث حالة الطلب، سيتم تحديث updated_at تلقائياً
