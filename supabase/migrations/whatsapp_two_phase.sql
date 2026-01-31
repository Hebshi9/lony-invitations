-- ============================================
-- WhatsApp Two-Phase System & AI RSVP
-- ============================================

-- 1. Add message_phase to whatsapp_messages
ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS message_phase TEXT DEFAULT 'initial' CHECK (message_phase IN ('initial', 'personalized'));

-- 2. Update guests RSVP status options
ALTER TABLE guests 
DROP CONSTRAINT IF EXISTS guests_rsvp_status_check;

ALTER TABLE guests 
ADD CONSTRAINT guests_rsvp_status_check 
CHECK (rsvp_status IN ('pending', 'confirmed', 'declined', 'maybe'));

-- Add companion count
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS companion_count INTEGER DEFAULT 0;

-- Add RSVP notes
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS rsvp_notes TEXT;

-- Add RSVP timestamp
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS rsvp_at TIMESTAMP;

-- 3. Create whatsapp_replies table
CREATE TABLE IF NOT EXISTS whatsapp_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    reply_text TEXT NOT NULL,
    reply_type TEXT DEFAULT 'text' CHECK (reply_type IN ('text', 'image', 'audio', 'video')),
    
    -- AI Analysis
    is_rsvp BOOLEAN DEFAULT FALSE,
    rsvp_response TEXT CHECK (rsvp_response IN ('confirmed', 'declined', 'maybe', NULL)),
    ai_confidence FLOAT DEFAULT 0.0 CHECK (ai_confidence >= 0.0 AND ai_confidence <= 1.0),
    companion_count INTEGER DEFAULT 0,
    extracted_notes TEXT,
    
    -- Metadata
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_guest ON whatsapp_replies(guest_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_event ON whatsapp_replies(event_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_phone ON whatsapp_replies(phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_replies_processed ON whatsapp_replies(processed);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phase ON whatsapp_messages(message_phase);

-- 4. Enable RLS
ALTER TABLE whatsapp_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_replies
CREATE POLICY "Users can view their event replies"
    ON whatsapp_replies FOR SELECT
    USING (
        event_id IN (
            SELECT id FROM events WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert replies for their events"
    ON whatsapp_replies FOR INSERT
    WITH CHECK (
        event_id IN (
            SELECT id FROM events WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their event replies"
    ON whatsapp_replies FOR UPDATE
    USING (
        event_id IN (
            SELECT id FROM events WHERE user_id = auth.uid()
        )
    );

-- 5. Function to auto-update guest RSVP from reply
CREATE OR REPLACE FUNCTION update_guest_rsvp_from_reply()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if it's an RSVP reply with good confidence
    IF NEW.is_rsvp = TRUE AND NEW.ai_confidence >= 0.7 THEN
        UPDATE guests
        SET 
            rsvp_status = NEW.rsvp_response,
            companion_count = COALESCE(NEW.companion_count, 0),
            rsvp_notes = NEW.extracted_notes,
            rsvp_at = NEW.received_at,
            updated_at = NOW()
        WHERE id = NEW.guest_id;
        
        -- Mark reply as processed
        NEW.processed = TRUE;
        NEW.processed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_guest_rsvp ON whatsapp_replies;
CREATE TRIGGER trigger_update_guest_rsvp
    BEFORE INSERT ON whatsapp_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_rsvp_from_reply();

-- 6. Function to get RSVP statistics for an event
CREATE OR REPLACE FUNCTION get_event_rsvp_stats(event_uuid UUID)
RETURNS TABLE (
    total_guests BIGINT,
    confirmed BIGINT,
    declined BIGINT,
    maybe BIGINT,
    pending BIGINT,
    total_companions BIGINT,
    response_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_guests,
        COUNT(*) FILTER (WHERE rsvp_status = 'confirmed')::BIGINT as confirmed,
        COUNT(*) FILTER (WHERE rsvp_status = 'declined')::BIGINT as declined,
        COUNT(*) FILTER (WHERE rsvp_status = 'maybe')::BIGINT as maybe,
        COUNT(*) FILTER (WHERE rsvp_status = 'pending')::BIGINT as pending,
        COALESCE(SUM(companion_count), 0)::BIGINT as total_companions,
        ROUND(
            (COUNT(*) FILTER (WHERE rsvp_status != 'pending')::NUMERIC / 
            NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 
            2
        ) as response_rate
    FROM guests
    WHERE event_id = event_uuid;
END;
$$ LANGUAGE plpgsql;

-- 7. View for easy RSVP overview
CREATE OR REPLACE VIEW event_rsvp_overview AS
SELECT 
    e.id as event_id,
    e.name as event_name,
    e.date as event_date,
    COUNT(g.id) as total_guests,
    COUNT(g.id) FILTER (WHERE g.rsvp_status = 'confirmed') as confirmed_count,
    COUNT(g.id) FILTER (WHERE g.rsvp_status = 'declined') as declined_count,
    COUNT(g.id) FILTER (WHERE g.rsvp_status = 'maybe') as maybe_count,
    COUNT(g.id) FILTER (WHERE g.rsvp_status = 'pending') as pending_count,
    COALESCE(SUM(g.companion_count), 0) as total_companions,
    COUNT(r.id) as total_replies,
    ROUND(
        (COUNT(g.id) FILTER (WHERE g.rsvp_status != 'pending')::NUMERIC / 
        NULLIF(COUNT(g.id)::NUMERIC, 0)) * 100, 
        2
    ) as response_rate
FROM events e
LEFT JOIN guests g ON e.id = g.event_id
LEFT JOIN whatsapp_replies r ON g.id = r.guest_id
GROUP BY e.id, e.name, e.date;

COMMENT ON TABLE whatsapp_replies IS 'Stores WhatsApp replies from guests with AI analysis for RSVP detection';
COMMENT ON COLUMN whatsapp_replies.ai_confidence IS 'AI confidence score (0.0-1.0) for RSVP classification';
COMMENT ON FUNCTION get_event_rsvp_stats IS 'Get comprehensive RSVP statistics for an event';
