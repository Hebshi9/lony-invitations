-- =====================================================================================================
-- 🔐 PHASE 1: Security Setup - Authentication & RLS Policies
-- =====================================================================================================
-- Run this in Supabase SQL Editor after enabling Authentication
-- =====================================================================================================

-- ========================================
-- PART 1: إضافة user_id للجداول
-- ========================================

-- أضف user_id لجدول events
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Set user_id for existing events (optional - assign to first user or leave NULL)
-- UPDATE events SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;

-- Index للأداء
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);

COMMENT ON COLUMN events.user_id IS 'معرف المستخدم صاحب الحدث';

-- ========================================
-- PART 2: تفعيل RLS على جميع الجداول
-- ========================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_analytics ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PART 3: RLS Policies للـ EVENTS
-- ========================================

-- حذف الـ policies القديمة إن وجدت
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can create own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

-- المستخدمون يرون أحداثهم فقط
CREATE POLICY "Users can view own events"
ON events FOR SELECT
USING (auth.uid() = user_id);

-- المستخدمون ينشئون أحداثهم
CREATE POLICY "Users can create own events"
ON events FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- المستخدمون يعدلون أحداثهم فقط
CREATE POLICY "Users can update own events"
ON events FOR UPDATE
USING (auth.uid() = user_id);

-- المستخدمون يحذفون أحداثهم فقط
CREATE POLICY "Users can delete own events"
ON events FOR DELETE
USING (auth.uid() = user_id);

-- ========================================
-- PART 4: RLS Policies للـ GUESTS
-- ========================================

DROP POLICY IF EXISTS "Users can view guests of own events" ON guests;
DROP POLICY IF EXISTS "Users can insert guests to own events" ON guests;
DROP POLICY IF EXISTS "Users can update guests of own events" ON guests;
DROP POLICY IF EXISTS "Users can delete guests of own events" ON guests;

-- المستخدمون يرون ضيوف أحداثهم فقط
CREATE POLICY "Users can view guests of own events"
ON guests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = guests.event_id 
        AND events.user_id = auth.uid()
    )
);

-- المستخدمون يضيفون ضيوف لأحداثهم
CREATE POLICY "Users can insert guests to own events"
ON guests FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = guests.event_id 
        AND events.user_id = auth.uid()
    )
);

-- المستخدمون يعدلون ضيوف أحداثهم
CREATE POLICY "Users can update guests of own events"
ON guests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = guests.event_id 
        AND events.user_id = auth.uid()
    )
);

-- المستخدمون يحذفون ضيوف أحداثهم
CREATE POLICY "Users can delete guests of own events"
ON guests FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = guests.event_id 
        AND events.user_id = auth.uid()
    )
);

-- ========================================
-- PART 5: RLS Policies للجداول الأخرى
-- ========================================

-- SCANS (مربوط بـ events)
DROP POLICY IF EXISTS "Users can view scans of own events" ON scans;
DROP POLICY IF EXISTS "Users can insert scans to own events" ON scans;

CREATE POLICY "Users can view scans of own events"
ON scans FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = scans.event_id 
        AND events.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert scans to own events"
ON scans FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = scans.event_id 
        AND events.user_id = auth.uid()
    )
);

-- CARD_TEMPLATES (عام - الكل يقرأ)
DROP POLICY IF EXISTS "Anyone can view active templates" ON card_templates;
CREATE POLICY "Anyone can view active templates"
ON card_templates FOR SELECT
USING (is_active = true);

-- EXPORT_JOBS (مربوط بـ events)
DROP POLICY IF EXISTS "Users can view export jobs of own events" ON export_jobs;
CREATE POLICY "Users can view export jobs of own events"
ON export_jobs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = export_jobs.event_id 
        AND events.user_id = auth.uid()
    )
);

-- CARD_ANALYTICS (مربوط بـ events)
DROP POLICY IF EXISTS "Users can view analytics of own events" ON card_analytics;
CREATE POLICY "Users can view analytics of own events"
ON card_analytics FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = card_analytics.event_id 
        AND events.user_id = auth.uid()
    )
);

-- ========================================
-- PART 6: Helper Function للتحقق
-- ========================================

CREATE OR REPLACE FUNCTION is_event_owner(p_event_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM events
        WHERE id = p_event_id
        AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ Security Setup Complete!';
    RAISE NOTICE 'RLS Enabled: events, guests, scans, card_templates';
    RAISE NOTICE 'Policies Created: 15+ policies';
    RAISE NOTICE 'Next Step: Update your frontend to use auth.uid()';
END $$;
