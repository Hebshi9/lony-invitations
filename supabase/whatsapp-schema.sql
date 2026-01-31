-- WhatsApp Integration Schema
-- Add this to your Supabase SQL Editor

-- جدول الرسائل
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    message_text TEXT NOT NULL,
    image_url TEXT, -- رابط صورة الدعوة
    status TEXT DEFAULT 'pending', -- 'pending', 'queued', 'sent', 'failed', 'delivered', 'read'
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sender_account TEXT, -- الرقم الذي أرسل منه (للتتبع)
    created_at TIMESTAMP DEFAULT NOW()
);

-- جدول حسابات WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    name TEXT, -- اسم تعريفي للحساب
    status TEXT DEFAULT 'disconnected', -- 'connected', 'disconnected', 'banned'
    daily_limit INTEGER DEFAULT 170,
    messages_sent_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    session_data JSONB, -- بيانات الجلسة
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_event ON whatsapp_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_account ON whatsapp_messages(sender_account);
CREATE INDEX IF NOT EXISTS idx_whatsapp_guest ON whatsapp_messages(guest_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_status ON whatsapp_accounts(status);

-- Enable Row Level Security
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_messages
DROP POLICY IF EXISTS "Allow public read whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Allow public read whatsapp_messages" 
ON whatsapp_messages 
FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow public insert whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Allow public insert whatsapp_messages" 
ON whatsapp_messages 
FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update whatsapp_messages" ON whatsapp_messages;
CREATE POLICY "Allow public update whatsapp_messages" 
ON whatsapp_messages 
FOR UPDATE 
TO public 
USING (true);

-- Policies for whatsapp_accounts
DROP POLICY IF EXISTS "Allow public read whatsapp_accounts" ON whatsapp_accounts;
CREATE POLICY "Allow public read whatsapp_accounts" 
ON whatsapp_accounts 
FOR SELECT 
TO public 
USING (true);

DROP POLICY IF EXISTS "Allow public insert whatsapp_accounts" ON whatsapp_accounts;
CREATE POLICY "Allow public insert whatsapp_accounts" 
ON whatsapp_accounts 
FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update whatsapp_accounts" ON whatsapp_accounts;
CREATE POLICY "Allow public update whatsapp_accounts" 
ON whatsapp_accounts 
FOR UPDATE 
TO public 
USING (true);

-- Function to reset daily message counts
CREATE OR REPLACE FUNCTION reset_daily_whatsapp_counts()
RETURNS void AS $$
BEGIN
    UPDATE whatsapp_accounts
    SET messages_sent_today = 0,
        last_reset_date = CURRENT_DATE
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- You can set up a cron job in Supabase to run this daily
-- Or call it from your backend before sending messages
