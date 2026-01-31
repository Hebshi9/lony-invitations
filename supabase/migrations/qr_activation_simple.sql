-- ═══════════════════════════════════════════════════════════════
-- QR Activation Setup - نسخ والصق في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- الخطوة 1: إضافة الحقول الجديدة
ALTER TABLE events
ADD COLUMN IF NOT EXISTS qr_activation_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS qr_active_from TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS qr_active_until TIMESTAMP WITH TIME ZONE;

-- الخطوة 2: تفعيل الميزة للحدث الأول (للاختبار)
UPDATE events 
SET qr_activation_enabled = TRUE,
    qr_active_from = NOW() - INTERVAL '1 hour',
    qr_active_until = NOW() + INTERVAL '23 hours'
WHERE id = (SELECT id FROM events LIMIT 1);

-- الخطوة 3: عرض روابط الاختبار
SELECT 
    e.name AS event_name,
    g.name AS guest_name,
    CONCAT('https://lonyinvite.netlify.app/check-in.html?token=', g.qr_token) AS test_url,
    CASE 
        WHEN NOT e.qr_activation_enabled THEN '⚪ معطل'
        WHEN NOW() < e.qr_active_from THEN '⏰ قيد الانتظار'
        WHEN NOW() > e.qr_active_until THEN '❌ منتهي'
        ELSE '✅ نشط'
    END AS status
FROM guests g
JOIN events e ON g.event_id = e.id
LIMIT 3;
