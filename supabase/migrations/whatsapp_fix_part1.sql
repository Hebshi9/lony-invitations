-- الجزء الأول (المعدل): تنظيف البيانات وإنشاء الجداول
-- (Part 1 Fixed: Clean data & Create Tables)
-- شغل هذا الكود مجدداً بدلاً من السابق

-- 1. FIX & SETUP whatsapp_messages
-- Ensure column exists
ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS message_phase TEXT DEFAULT 'initial';

-- CRITICAL: Fix bad data before adding constraints
UPDATE whatsapp_messages 
SET message_phase = 'initial' 
WHERE message_phase IS NULL OR message_phase NOT IN ('initial', 'personalized');

-- Now apply constraint safely
ALTER TABLE whatsapp_messages 
DROP CONSTRAINT IF EXISTS whatsapp_messages_phase_check;

ALTER TABLE whatsapp_messages
ADD CONSTRAINT whatsapp_messages_phase_check 
CHECK (message_phase IN ('initial', 'personalized'));

-- 2. FIX & SETUP guests
-- Fix bad rsvp statuses first
UPDATE guests
SET rsvp_status = 'pending'
WHERE rsvp_status IS NULL OR rsvp_status NOT IN ('pending', 'confirmed', 'declined', 'maybe', 'attended');

ALTER TABLE guests 
DROP CONSTRAINT IF EXISTS guests_rsvp_status_check;

ALTER TABLE guests 
ADD CONSTRAINT guests_rsvp_status_check 
CHECK (rsvp_status IN ('pending', 'confirmed', 'declined', 'maybe', 'attended'));

-- Add columns
ALTER TABLE guests ADD COLUMN IF NOT EXISTS companion_count INTEGER DEFAULT 0;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS rsvp_notes TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS rsvp_at TIMESTAMP;

-- 3. Create whatsapp_replies table
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
    ai_confidence FLOAT DEFAULT 0.0,
    companion_count INTEGER DEFAULT 0,
    extracted_notes TEXT,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_guest ON whatsapp_replies(guest_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_event ON whatsapp_replies(event_id);

-- RLS
ALTER TABLE whatsapp_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their event replies" ON whatsapp_replies;
CREATE POLICY "Users can view their event replies" ON whatsapp_replies FOR SELECT
USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert replies for their events" ON whatsapp_replies;
CREATE POLICY "Users can insert replies for their events" ON whatsapp_replies FOR INSERT
WITH CHECK (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their event replies" ON whatsapp_replies;
CREATE POLICY "Users can update their event replies" ON whatsapp_replies FOR UPDATE
USING (event_id IN (SELECT id FROM events WHERE user_id = auth.uid()));
