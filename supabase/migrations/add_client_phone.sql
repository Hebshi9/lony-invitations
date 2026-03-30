-- Add client_phone to events (if not already added by guest_replacement_schema.sql)
ALTER TABLE events ADD COLUMN IF NOT EXISTS client_phone TEXT;
COMMENT ON COLUMN events.client_phone IS 'رقم واتساب صاحب المناسبة للإشعارات والتنسيق';

-- Add RSVP cycle columns (if not already added)
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_cycle_status TEXT DEFAULT 'idle';
ALTER TABLE events ADD COLUMN IF NOT EXISTS invitations_sent_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_replacements INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS used_replacements INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS summary_sent_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

-- Create pending_replacements table if not exists
CREATE TABLE IF NOT EXISTS pending_replacements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    declined_guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    declined_guest_name TEXT,
    client_phone TEXT NOT NULL,
    account_id TEXT,
    status TEXT DEFAULT 'awaiting_reply' CHECK (status IN ('awaiting_reply', 'completed', 'expired', 'skipped')),
    client_notified_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create guest_replacements table if not exists
CREATE TABLE IF NOT EXISTS guest_replacements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    original_guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    replacement_guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    original_guest_name TEXT,
    replacement_guest_name TEXT,
    replacement_phone TEXT,
    card_generated BOOLEAN DEFAULT false,
    card_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- RLS
ALTER TABLE pending_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_replacements ENABLE ROW LEVEL SECURITY;

-- Policies (permissive for now)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow all pending_replacements'
    ) THEN
        CREATE POLICY "Allow all pending_replacements" ON pending_replacements FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow all guest_replacements'
    ) THEN
        CREATE POLICY "Allow all guest_replacements" ON guest_replacements FOR ALL TO public USING (true) WITH CHECK (true);
    END IF;
END $$;
