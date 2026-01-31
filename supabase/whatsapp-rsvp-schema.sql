-- WhatsApp RSVP System
-- Add tables for tracking guest responses and automatic card sending

-- جدول تتبع RSVP (تأكيد الحضور)
CREATE TABLE IF NOT EXISTS whatsapp_rsvp (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    response TEXT CHECK (response IN ('confirmed', 'declined', 'maybe')),
    response_message TEXT, -- الرسالة الأصلية من الضيف
    response_received_at TIMESTAMP DEFAULT NOW(),
    card_sent BOOLEAN DEFAULT false, -- هل تم إرسال الكرت؟
    card_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rsvp_guest ON whatsapp_rsvp(guest_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_event ON whatsapp_rsvp(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_response ON whatsapp_rsvp(response);

-- Enable RLS
ALTER TABLE whatsapp_rsvp ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read whatsapp_rsvp" 
ON whatsapp_rsvp 
FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Allow public insert whatsapp_rsvp" 
ON whatsapp_rsvp 
FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Allow public update whatsapp_rsvp" 
ON whatsapp_rsvp 
FOR UPDATE 
TO public 
USING (true);

-- Function to update guest RSVP status when response is recorded
CREATE OR REPLACE FUNCTION update_guest_rsvp_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update guest's rsvp_status
    UPDATE guests
    SET rsvp_status = NEW.response,
        updated_at = NOW()
    WHERE id = NEW.guest_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update guest status
CREATE TRIGGER trigger_update_guest_rsvp
AFTER INSERT ON whatsapp_rsvp
FOR EACH ROW
EXECUTE FUNCTION update_guest_rsvp_status();
