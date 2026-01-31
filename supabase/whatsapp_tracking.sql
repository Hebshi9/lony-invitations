-- تحديثات قاعدة البيانات لتتبع WhatsApp

-- 1. إضافة أعمدة التتبع لجدول whatsapp_messages
ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent';

-- 2. إنشاء جدول الردود
CREATE TABLE IF NOT EXISTS whatsapp_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    reply_text TEXT NOT NULL,
    reply_type TEXT DEFAULT 'text',
    is_rsvp BOOLEAN DEFAULT FALSE,
    rsvp_response TEXT CHECK (rsvp_response IN ('confirmed', 'declined', 'maybe')),
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. إضافة فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_guest ON whatsapp_replies(guest_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_event ON whatsapp_replies(event_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_message ON whatsapp_replies(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_event ON whatsapp_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_guest ON whatsapp_messages(guest_id);

-- 4. تحديث جدول guests لإضافة حالة RSVP من WhatsApp
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS whatsapp_rsvp_status TEXT CHECK (whatsapp_rsvp_status IN ('confirmed', 'declined', 'maybe')),
ADD COLUMN IF NOT EXISTS whatsapp_rsvp_at TIMESTAMP;

-- 5. إنشاء view لصفحة العميل (معلومات مبسطة)
CREATE OR REPLACE VIEW client_whatsapp_view AS
SELECT 
    g.id as guest_id,
    g.name as guest_name,
    g.phone,
    g.whatsapp_rsvp_status,
    g.whatsapp_rsvp_at,
    wm.delivery_status,
    wm.sent_at,
    wm.delivered_at,
    wm.read_at,
    wm.event_id,
    CASE 
        WHEN wm.status = 'failed' THEN 'pending'
        ELSE wm.status 
    END as status
FROM guests g
LEFT JOIN whatsapp_messages wm ON g.id = wm.guest_id
WHERE wm.id IS NOT NULL OR g.whatsapp_rsvp_status IS NOT NULL;

-- 6. إنشاء view لصفحة مقدم الخدمة (تفاصيل كاملة)
CREATE OR REPLACE VIEW admin_whatsapp_view AS
SELECT 
    wm.id as message_id,
    g.id as guest_id,
    g.name as guest_name,
    wm.phone,
    wm.status,
    wm.delivery_status,
    wm.sent_at,
    wm.delivered_at,
    wm.read_at,
    wm.error_message,
    wm.retry_count,
    wm.sender_account,
    g.whatsapp_rsvp_status,
    g.whatsapp_rsvp_at,
    wm.event_id,
    wm.created_at
FROM whatsapp_messages wm
LEFT JOIN guests g ON wm.guest_id = g.id;

-- 7. دالة للحصول على قائمة المعتذرين
CREATE OR REPLACE FUNCTION get_declined_guests(p_event_id UUID)
RETURNS TABLE (
    guest_name TEXT,
    phone TEXT,
    declined_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.name,
        g.phone,
        g.whatsapp_rsvp_at
    FROM guests g
    WHERE g.event_id = p_event_id
    AND g.whatsapp_rsvp_status = 'declined'
    ORDER BY g.whatsapp_rsvp_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. دالة للحصول على إحصائيات RSVP
CREATE OR REPLACE FUNCTION get_rsvp_stats(p_event_id UUID)
RETURNS TABLE (
    total_guests INTEGER,
    total_sent INTEGER,
    total_delivered INTEGER,
    total_read INTEGER,
    total_confirmed INTEGER,
    total_declined INTEGER,
    total_maybe INTEGER,
    total_no_response INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT g.id)::INTEGER as total_guests,
        COUNT(DISTINCT CASE WHEN wm.status = 'sent' THEN wm.id END)::INTEGER as total_sent,
        COUNT(DISTINCT CASE WHEN wm.delivery_status = 'delivered' THEN wm.id END)::INTEGER as total_delivered,
        COUNT(DISTINCT CASE WHEN wm.delivery_status = 'read' THEN wm.id END)::INTEGER as total_read,
        COUNT(DISTINCT CASE WHEN g.whatsapp_rsvp_status = 'confirmed' THEN g.id END)::INTEGER as total_confirmed,
        COUNT(DISTINCT CASE WHEN g.whatsapp_rsvp_status = 'declined' THEN g.id END)::INTEGER as total_declined,
        COUNT(DISTINCT CASE WHEN g.whatsapp_rsvp_status = 'maybe' THEN g.id END)::INTEGER as total_maybe,
        COUNT(DISTINCT CASE WHEN g.whatsapp_rsvp_status IS NULL AND wm.delivery_status = 'read' THEN g.id END)::INTEGER as total_no_response
    FROM guests g
    LEFT JOIN whatsapp_messages wm ON g.id = wm.guest_id
    WHERE g.event_id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Row Level Security (RLS) للـ views
ALTER VIEW client_whatsapp_view OWNER TO postgres;
ALTER VIEW admin_whatsapp_view OWNER TO postgres;

-- 10. منح الصلاحيات
GRANT SELECT ON client_whatsapp_view TO anon, authenticated;
GRANT SELECT ON admin_whatsapp_view TO authenticated;
GRANT SELECT ON whatsapp_replies TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_declined_guests TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_rsvp_stats TO anon, authenticated;
