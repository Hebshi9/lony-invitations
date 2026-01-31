-- ==============================================
-- 🔧 سكريبت إصلاح قاعدة البيانات الكامل
-- ==============================================
-- نسخ هذا الملف بالكامل وتنفيذه في Supabase SQL Editor

-- ==============================================
-- 1️⃣ تحديث جدول EVENTS
-- ==============================================

-- إضافة الأعمدة الناقصة
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS client_id TEXT,
ADD COLUMN IF NOT EXISTS client_access_code TEXT,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS scan_config JSONB,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- دالة لتحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger لجدول events
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at 
BEFORE UPDATE ON events 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 2️⃣ تحديث جدول GUESTS
-- ==============================================

-- إضافة الأعمدة الناقصة
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS rsvp_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS companions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS companions_attended INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_scans INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_data JSONB,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- تحديث max_scans للضيوف الموجودين (هو + مرافقيه)
UPDATE guests 
SET max_scans = 1 + COALESCE(companions_count, 0) 
WHERE max_scans = 1 AND companions_count > 0;

-- Trigger لجدول guests
DROP TRIGGER IF EXISTS update_guests_updated_at ON guests;
CREATE TRIGGER update_guests_updated_at 
BEFORE UPDATE ON guests 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 3️⃣ تحديث جدول SCANS
-- ==============================================

-- إضافة الأعمدة الناقصة
ALTER TABLE scans 
ADD COLUMN IF NOT EXISTS scan_result TEXT DEFAULT 'success',
ADD COLUMN IF NOT EXISTS scanned_companions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS inspector_name TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- إضافة قيد على scan_result
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_result_check;
ALTER TABLE scans
ADD CONSTRAINT scans_result_check 
CHECK (scan_result IN ('success', 'duplicate', 'invalid', 'exceeded_limit'));

-- ==============================================
-- 4️⃣ Row Level Security (RLS)
-- ==============================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- 5️⃣ السياسات (Policies)
-- ==============================================

-- سياسات جدول EVENTS
DROP POLICY IF EXISTS "Allow public event read" ON events;
CREATE POLICY "Allow public event read" 
ON events FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow public event insert" ON events;
CREATE POLICY "Allow public event insert" 
ON events FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public event update" ON events;
CREATE POLICY "Allow public event update" 
ON events FOR UPDATE 
TO public 
USING (true);

-- سياسات جدول GUESTS
DROP POLICY IF EXISTS "Allow public guest read" ON guests;
CREATE POLICY "Allow public guest read" 
ON guests FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow public guest insert" ON guests;
CREATE POLICY "Allow public guest insert" 
ON guests FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public guest update" ON guests;
CREATE POLICY "Allow public guest update" 
ON guests FOR UPDATE 
TO public 
USING (true);

-- سياسات جدول SCANS
DROP POLICY IF EXISTS "Allow public scan read" ON scans;
CREATE POLICY "Allow public scan read" 
ON scans FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow public scan insert" ON scans;
CREATE POLICY "Allow public scan insert" 
ON scans FOR INSERT 
TO public 
WITH CHECK (true);

-- ==============================================
-- 6️⃣ بيانات تجريبية (اختياري)
-- ==============================================

-- يمكنك حذف هذا القسم إذا لم تكن تريد بيانات تجريبية

-- إنشاء حدث تجريبي
INSERT INTO events (name, date, venue, token, client_id, client_access_code, start_date, end_date) 
VALUES (
  'حفل زفاف تجريبي',
  '2025-12-31',
  'الرياض - قاعة الملك فهد',
  'test-token-' || EXTRACT(EPOCH FROM NOW())::TEXT,
  'client-001',
  'ACCESS-2025',
  NOW(),
  NOW() + INTERVAL '30 days'
) 
ON CONFLICT DO NOTHING
RETURNING id;

-- ملاحظة: احفظ event_id من النتيجة أعلاه واستبدله في EVENT_ID_HERE أدناه
-- أو شغّل الاستعلام التالي للحصول على آخر event_id:
-- SELECT id FROM events ORDER BY created_at DESC LIMIT 1;

-- بعد الحصول على event_id، استبدل 'EVENT_ID_HERE' واحذف التعليق:

-- إضافة ضيوف تجريبيين
/*
INSERT INTO guests (
  event_id, 
  name, 
  qr_payload, 
  serial, 
  table_no, 
  status,
  phone,
  companions_count,
  max_scans,
  rsvp_status
) VALUES 
  (
    'EVENT_ID_HERE',  -- استبدل هذا بـ event_id الفعلي
    'أحمد محمد العلي', 
    'qr-' || gen_random_uuid()::TEXT, 
    'S-001', 
    '1', 
    'pending',
    '+966501234567',
    2,  -- عدد المرافقين
    3,  -- هو + 2 مرافقين = 3 مسح أقصى
    'confirmed'
  ),
  (
    'EVENT_ID_HERE',
    'فاطمة علي أحمد', 
    'qr-' || gen_random_uuid()::TEXT, 
    'S-002', 
    '2', 
    'attended',
    '+966507654321',
    1,  -- مرافق واحد
    2,  -- هي + مرافق = 2 مسح
    'confirmed'
  ),
  (
    'EVENT_ID_HERE',
    'خالد سعيد محمد', 
    'qr-' || gen_random_uuid()::TEXT, 
    'S-003', 
    '3', 
    'pending',
    '+966501112222',
    0,  -- بدون مرافقين
    1,  -- هو فقط
    'pending'
  ),
  (
    'EVENT_ID_HERE',
    'نورة عبدالله', 
    'qr-' || gen_random_uuid()::TEXT, 
    'S-004', 
    '4', 
    'pending',
    '+966503334444',
    3,  -- 3 مرافقين
    4,  -- هي + 3 = 4
    'confirmed'
  ),
  (
    'EVENT_ID_HERE',
    'سارة حسن', 
    'qr-' || gen_random_uuid()::TEXT, 
    'S-005', 
    '5', 
    'cancelled',
    '+966505556666',
    0,
    1,
    'declined'
  );
*/

-- ==============================================
-- 7️⃣ التحقق من النجاح
-- ==============================================

-- عرض أعمدة جدول events
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- عرض أعمدة جدول guests
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'guests' 
ORDER BY ordinal_position;

-- عرض أعمدة جدول scans
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'scans' 
ORDER BY ordinal_position;

-- عرض السياسات المفعلة
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('events', 'guests', 'scans')
ORDER BY tablename, policyname;

-- ==============================================
-- ✅ تم! 
-- ==============================================
-- قاعدة البيانات الآن محدّثة بالكامل
-- يمكنك تشغيل الاختبارات: npm run test:db
-- ==============================================
