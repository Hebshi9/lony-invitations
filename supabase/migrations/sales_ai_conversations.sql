-- ===================================================
-- جدول محادثات Sales AI (العملاء المحتملين)
-- ===================================================

-- إنشاء جدول المحادثات
CREATE TABLE IF NOT EXISTS sales_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    client_name VARCHAR(255),
    
    -- تفاصيل المحادثة
    first_contact_at TIMESTAMPTZ DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ DEFAULT NOW(),
    message_count INTEGER DEFAULT 1,
    
    -- التحليل والتقييم
    overall_intent VARCHAR(50), -- inquiry, negotiation, closing, escalation
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    status VARCHAR(50) DEFAULT 'active', -- active, closed, escalated, converted
    
    -- الملخص والملاحظات
    conversation_summary TEXT,
    ai_notes TEXT,
    admin_notes TEXT,
    
    -- التتبع
    escalated BOOLEAN DEFAULT FALSE,
    escalated_at TIMESTAMPTZ,
    converted_to_client BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- جدول الرسائل الفردية
CREATE TABLE IF NOT EXISTS sales_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES sales_conversations(id) ON DELETE CASCADE,
    
    -- تفاصيل الرسالة
    direction VARCHAR(20) NOT NULL, -- 'incoming' or 'outgoing'
    sender_phone VARCHAR(20),
    message_text TEXT NOT NULL,
    
    -- رد الـ AI
    ai_response TEXT,
    ai_intent VARCHAR(50),
    ai_priority VARCHAR(20),
    ai_confidence DECIMAL(3,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_sales_conversations_phone ON sales_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_sales_conversations_status ON sales_conversations(status);
CREATE INDEX IF NOT EXISTS idx_sales_conversations_escalated ON sales_conversations(escalated);
CREATE INDEX IF NOT EXISTS idx_sales_messages_conversation ON sales_messages(conversation_id);

-- Trigger للتحديث التلقائي
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sales_conversations
    SET 
        last_contact_at = NOW(),
        message_count = message_count + 1,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation
    AFTER INSERT ON sales_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- View للملخص السريع
CREATE OR REPLACE VIEW sales_dashboard AS
SELECT 
    c.id,
    c.phone,
    c.client_name,
    c.status,
    c.priority,
    c.message_count,
    c.overall_intent,
    c.escalated,
    c.first_contact_at,
    c.last_contact_at,
    c.conversation_summary,
    (
        SELECT message_text 
        FROM sales_messages 
        WHERE conversation_id = c.id 
            AND direction = 'incoming'
        ORDER BY created_at DESC 
        LIMIT 1
    ) as last_message,
    (
        SELECT ai_response 
        FROM sales_messages 
        WHERE conversation_id = c.id 
            AND direction = 'outgoing'
        ORDER BY created_at DESC 
        LIMIT 1
    ) as last_ai_response
FROM sales_conversations c
ORDER BY c.last_contact_at DESC;

COMMENT ON TABLE sales_conversations IS 'تخزين محادثات Sales AI مع العملاء المحتملين';
COMMENT ON TABLE sales_messages IS 'الرسائل الفردية لكل محادثة';
COMMENT ON VIEW sales_dashboard IS 'نظرة سريعة على جميع المحادثات النشطة';
