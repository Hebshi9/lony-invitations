-- =====================================================
-- نظام استبدال الضيوف + إشعارات الاعتذار
-- Guest Replacement & Decline Notification System
-- =====================================================

-- 1. إضافة حقل رقم العميل في جدول الأحداث
ALTER TABLE events
ADD COLUMN IF NOT EXISTS client_phone TEXT;

-- 2. جدول الاستبدالات المعلقة (ينتظر رد العميل)
CREATE TABLE IF NOT EXISTS pending_replacements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    declined_guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    declined_guest_name TEXT,
    client_phone TEXT NOT NULL,
    account_id TEXT, -- WhatsApp account instance used
    status TEXT DEFAULT 'awaiting_reply' CHECK (status IN ('awaiting_reply', 'completed', 'expired', 'skipped')),
    client_notified_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. جدول سجل الاستبدالات المكتملة
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

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_pending_replacements_event ON pending_replacements(event_id);
CREATE INDEX IF NOT EXISTS idx_pending_replacements_status ON pending_replacements(status);
CREATE INDEX IF NOT EXISTS idx_pending_replacements_client ON pending_replacements(client_phone);
CREATE INDEX IF NOT EXISTS idx_guest_replacements_event ON guest_replacements(event_id);

-- 5. Enable RLS
ALTER TABLE pending_replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_replacements ENABLE ROW LEVEL SECURITY;

-- 6. Policies (allow all for now, tighten later)
CREATE POLICY "Allow all pending_replacements" ON pending_replacements FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all guest_replacements" ON guest_replacements FOR ALL TO public USING (true) WITH CHECK (true);

-- 7. Auto-expire pending replacements after 24 hours (optional function)
CREATE OR REPLACE FUNCTION expire_old_pending_replacements()
RETURNS void AS $$
BEGIN
    UPDATE pending_replacements
    SET status = 'expired'
    WHERE status = 'awaiting_reply'
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
