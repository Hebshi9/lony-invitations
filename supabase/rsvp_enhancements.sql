-- RSVP Feature Enhancements
-- تحسينات ميزة الموافقة/الاعتذار

-- =====================================================
-- 1. إضافة حقول جديدة لجدول guests
-- =====================================================

-- إضافة حقل تاريخ الرد على RSVP
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS rsvp_date TIMESTAMP;

-- إضافة حقول تتبع إرسال الدعوات
ALTER TABLE guests
ADD COLUMN IF NOT EXISTS sent_general_at TIMESTAMP,   -- تاريخ إرسال الكرت العام
ADD COLUMN IF NOT EXISTS sent_personal_at TIMESTAMP,  -- تاريخ إرسال الكرت الشخصي
ADD COLUMN IF NOT EXISTS invitation_phase INTEGER DEFAULT 1; -- 1 = عام, 2 = شخصي

-- إضافة حقل لتجميع الضيوف (VIP, Family, Friends)
ALTER TABLE guests
ADD COLUMN IF NOT EXISTS guest_category TEXT DEFAULT 'general';

-- =====================================================
-- 2. إنشاء Trigger لتحديث rsvp_date تلقائياً
-- =====================================================

-- دالة لتحديث تاريخ الرد
CREATE OR REPLACE FUNCTION update_rsvp_date()
RETURNS TRIGGER AS $$
BEGIN
    -- إذا تغيرت حالة RSVP من pending إلى confirmed أو declined
    IF NEW.rsvp_status IS DISTINCT FROM OLD.rsvp_status 
       AND OLD.rsvp_status = 'pending' 
       AND NEW.rsvp_status IN ('confirmed', 'declined') THEN
        NEW.rsvp_date = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء Trigger
DROP TRIGGER IF EXISTS trigger_update_rsvp_date ON guests;
CREATE TRIGGER trigger_update_rsvp_date
    BEFORE UPDATE ON guests
    FOR EACH ROW
    EXECUTE FUNCTION update_rsvp_date();

-- =====================================================
-- 3. إنشاء جدول لتتبع دفعات الإرسال
-- =====================================================

CREATE TABLE IF NOT EXISTS sending_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    phase INTEGER NOT NULL,                    -- 1 = عام, 2 = شخصي
    batch_number INTEGER NOT NULL,             -- رقم الدفعة
    batch_group TEXT,                          -- 'VIP', 'Family', 'Friends', 'General'
    total_messages INTEGER NOT NULL,           -- عدد الرسائل المخطط إرسالها
    sent_count INTEGER DEFAULT 0,              -- عدد الرسائل المرسلة فعلياً
    failed_count INTEGER DEFAULT 0,            -- عدد الرسائل الفاشلة
    status TEXT DEFAULT 'pending',             -- 'pending', 'sending', 'completed', 'failed'
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_sending_batches_event ON sending_batches(event_id);
CREATE INDEX IF NOT EXISTS idx_sending_batches_status ON sending_batches(status);

-- Enable RLS
ALTER TABLE sending_batches ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow auth all sending_batches" ON sending_batches;
CREATE POLICY "Allow auth all sending_batches" 
ON sending_batches 
FOR ALL 
TO authenticated 
USING (true);

-- =====================================================
-- 4. دالة للحصول على إحصائيات RSVP
-- =====================================================

CREATE OR REPLACE FUNCTION get_rsvp_stats(p_event_id UUID)
RETURNS TABLE (
    total_guests BIGINT,
    rsvp_confirmed BIGINT,
    rsvp_declined BIGINT,
    rsvp_pending BIGINT,
    attended BIGINT,
    total_companions BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_guests,
        COUNT(*) FILTER (WHERE rsvp_status = 'confirmed')::BIGINT as rsvp_confirmed,
        COUNT(*) FILTER (WHERE rsvp_status = 'declined')::BIGINT as rsvp_declined,
        COUNT(*) FILTER (WHERE rsvp_status = 'pending')::BIGINT as rsvp_pending,
        COUNT(*) FILTER (WHERE status = 'attended')::BIGINT as attended,
        COALESCE(SUM(companions_count), 0)::BIGINT as total_companions
    FROM guests
    WHERE event_id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. دالة للحصول على الضيوف حسب حالة RSVP
-- =====================================================

CREATE OR REPLACE FUNCTION get_guests_by_rsvp_status(
    p_event_id UUID,
    p_rsvp_status TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    rsvp_status TEXT,
    rsvp_date TIMESTAMP,
    status TEXT,
    companions_count INTEGER,
    qr_token TEXT,
    card_url TEXT
) AS $$
BEGIN
    IF p_rsvp_status IS NULL THEN
        RETURN QUERY
        SELECT 
            g.id, g.name, g.phone, g.rsvp_status, g.rsvp_date,
            g.status, g.companions_count, g.qr_token, g.card_url
        FROM guests g
        WHERE g.event_id = p_event_id
        ORDER BY g.created_at DESC;
    ELSE
        RETURN QUERY
        SELECT 
            g.id, g.name, g.phone, g.rsvp_status, g.rsvp_date,
            g.status, g.companions_count, g.qr_token, g.card_url
        FROM guests g
        WHERE g.event_id = p_event_id 
        AND g.rsvp_status = p_rsvp_status
        ORDER BY g.created_at DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. تحديث Trigger لـ updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sending_batches_updated_at ON sending_batches;
CREATE TRIGGER update_sending_batches_updated_at
    BEFORE UPDATE ON sending_batches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. إضافة Indexes للأداء
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_guests_rsvp_status ON guests(rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guests_rsvp_date ON guests(rsvp_date);
CREATE INDEX IF NOT EXISTS idx_guests_sent_general ON guests(sent_general_at);
CREATE INDEX IF NOT EXISTS idx_guests_sent_personal ON guests(sent_personal_at);
CREATE INDEX IF NOT EXISTS idx_guests_category ON guests(guest_category);

-- =====================================================
-- 8. تحديث البيانات الموجودة (اختياري)
-- =====================================================

-- تعيين guest_category بناءً على البيانات الموجودة
-- يمكن تخصيص هذا حسب الحاجة
UPDATE guests 
SET guest_category = 'general' 
WHERE guest_category IS NULL;

-- =====================================================
-- تم الانتهاء من تحسينات RSVP
-- =====================================================

-- للتحقق من التطبيق الناجح:
-- SELECT * FROM get_rsvp_stats('your-event-id');
