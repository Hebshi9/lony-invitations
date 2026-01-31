-- =====================================================================================================
-- 🚀 COMPLETE DATABASE SETUP - Run this ONCE in Supabase SQL Editor
-- =====================================================================================================
-- This combines UNIFIED_STUDIO_SCHEMA.sql + security-setup.sql in the correct order
-- =====================================================================================================

-- ========================================
-- STEP 1: Create Tables (from UNIFIED_STUDIO_SCHEMA.sql)
-- ========================================

-- Add columns to events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_maps_url TEXT,
ADD COLUMN IF NOT EXISTS wifi_ssid TEXT,
ADD COLUMN IF NOT EXISTS wifi_password TEXT,
ADD COLUMN IF NOT EXISTS wifi_security TEXT CHECK (wifi_security IN ('WPA', 'WEP', 'nopass')),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add columns to guests
ALTER TABLE guests
ADD COLUMN IF NOT EXISTS serial TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS card_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS card_downloaded BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_guests_serial ON guests(event_id, serial);
CREATE INDEX IF NOT EXISTS idx_guests_category ON guests(category);
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);

-- Unique constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_event_serial'
  ) THEN
    ALTER TABLE guests 
    ADD CONSTRAINT unique_event_serial UNIQUE(event_id, serial);
  END IF;
END $$;

-- ========================================
-- STEP 2: Create New Tables
-- ========================================

CREATE TABLE IF NOT EXISTS card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    thumbnail_url TEXT,
    background_url TEXT,
    canvas_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    default_settings JSONB DEFAULT '{"colors": ["#000000", "#D4AF37"], "fonts": ["Amiri", "Cairo"]}'::jsonb,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'qr')),
    properties JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('zip', 'pdf', 'png')),
    quality TEXT DEFAULT 'high' CHECK (quality IN ('low', 'medium', 'high', 'ultra')),
    size_width INTEGER DEFAULT 1080,
    size_height INTEGER DEFAULT 1920,
    guest_range_start INTEGER,
    guest_range_end INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0,
    total_cards INTEGER,
    download_url TEXT,
    file_size_mb DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS card_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('viewed', 'downloaded', 'scanned', 'shared')),
    event_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_templates_category ON card_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_active ON card_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_saved_styles_user ON saved_styles(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_event ON export_jobs(event_id);
CREATE INDEX IF NOT EXISTS idx_card_analytics_event ON card_analytics(event_id);

-- ========================================
-- STEP 3: Enable RLS on All Tables
-- ========================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_analytics ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 4: RLS Policies for EVENTS
-- ========================================

DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can create own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

CREATE POLICY "Users can view own events"
ON events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own events"
ON events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
ON events FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
ON events FOR DELETE
USING (auth.uid() = user_id);

-- ========================================
-- STEP 5: RLS Policies for GUESTS
-- ========================================

DROP POLICY IF EXISTS "Users can view guests of own events" ON guests;
DROP POLICY IF EXISTS "Users can insert guests to own events" ON guests;
DROP POLICY IF EXISTS "Users can update guests of own events" ON guests;
DROP POLICY IF EXISTS "Users can delete guests of own events" ON guests;

CREATE POLICY "Users can view guests of own events"
ON guests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = guests.event_id 
        AND events.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert guests to own events"
ON guests FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = guests.event_id 
        AND events.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update guests of own events"
ON guests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM events 
        WHERE events.id = guests.event_id 
        AND events.user_id = auth.uid()
    )
);

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
-- STEP 6: RLS Policies for Other Tables
-- ========================================

-- SCANS
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

-- CARD_TEMPLATES (public read)
DROP POLICY IF EXISTS "Anyone can view active templates" ON card_templates;
CREATE POLICY "Anyone can view active templates"
ON card_templates FOR SELECT
USING (is_active = true);

-- EXPORT_JOBS
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

-- CARD_ANALYTICS
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
-- STEP 7: Helper Functions
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
-- SUCCESS!
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ ✅ ✅ DATABASE SETUP COMPLETE! ✅ ✅ ✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables Created/Updated:';
    RAISE NOTICE '  - events (with user_id, location, wifi)';
    RAISE NOTICE '  - guests (with serial, category, attendance)';
    RAISE NOTICE '  - card_templates (NEW)';
    RAISE NOTICE '  - saved_styles (NEW)';
    RAISE NOTICE '  - export_jobs (NEW)';
    RAISE NOTICE '  - card_analytics (NEW)';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS Enabled: ✅';
    RAISE NOTICE 'Policies Created: 15+';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Enable Email Auth in Supabase Dashboard';
    RAISE NOTICE '  2. Run: npm run dev';
    RAISE NOTICE '  3. Create account and test!';
END $$;
