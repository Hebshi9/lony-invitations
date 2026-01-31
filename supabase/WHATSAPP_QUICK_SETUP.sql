-- ============================================
-- WhatsApp Integration - Quick Setup
-- نفذ هذا الملف في Supabase SQL Editor
-- ============================================

-- 1. جدول حسابات WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE,
    name TEXT,
    status TEXT DEFAULT 'disconnected',
    daily_limit INTEGER DEFAULT 170,
    messages_sent_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    session_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. جدول الرسائل
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    message_text TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    delivery_status TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sender_account TEXT,
    message_phase TEXT DEFAULT 'initial',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. جدول الردود
CREATE TABLE IF NOT EXISTS whatsapp_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    reply_text TEXT NOT NULL,
    reply_type TEXT DEFAULT 'text',
    is_rsvp BOOLEAN DEFAULT FALSE,
    rsvp_response TEXT,
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_event ON whatsapp_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_guest ON whatsapp_messages(guest_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_status ON whatsapp_accounts(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_guest ON whatsapp_replies(guest_id);

-- 5. Enable RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_replies ENABLE ROW LEVEL SECURITY;

-- 6. Policies - Allow all for simplicity (تعديل حسب الحاجة)
DROP POLICY IF EXISTS "Allow all on whatsapp_accounts" ON whatsapp_accounts;
CREATE POLICY "Allow all on whatsapp_accounts" ON whatsapp_accounts FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Allow all on whatsapp_messages" ON whatsapp_messages FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on whatsapp_replies" ON whatsapp_replies;
CREATE POLICY "Allow all on whatsapp_replies" ON whatsapp_replies FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Function to reset daily counts
CREATE OR REPLACE FUNCTION reset_daily_whatsapp_counts()
RETURNS void AS $$
BEGIN
    UPDATE whatsapp_accounts
    SET messages_sent_today = 0,
        last_reset_date = CURRENT_DATE
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ✅ Done! الآن يمكنك استخدام WhatsApp Sender
