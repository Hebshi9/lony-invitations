-- =====================================================
-- 🚀 FINAL SETUP - Works Without Errors
-- =====================================================
-- This is the SAFE version that handles existing data
-- =====================================================

-- 1. Add missing columns to events (if not exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='location_lat') THEN
        ALTER TABLE events ADD COLUMN location_lat DECIMAL(10, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='location_lng') THEN
        ALTER TABLE events ADD COLUMN location_lng DECIMAL(11, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='location_maps_url') THEN
        ALTER TABLE events ADD COLUMN location_maps_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='wifi_ssid') THEN
        ALTER TABLE events ADD COLUMN wifi_ssid TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='wifi_password') THEN
        ALTER TABLE events ADD COLUMN wifi_password TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='wifi_security') THEN
        ALTER TABLE events ADD COLUMN wifi_security TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='user_id') THEN
        ALTER TABLE events ADD COLUMN user_id UUID;
    END IF;
END $$;

-- 2. Add missing columns to guests (if not exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guests' AND column_name='serial') THEN
        ALTER TABLE guests ADD COLUMN serial TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guests' AND column_name='category') THEN
        ALTER TABLE guests ADD COLUMN category TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guests' AND column_name='card_generated') THEN
        ALTER TABLE guests ADD COLUMN card_generated BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guests' AND column_name='card_downloaded') THEN
        ALTER TABLE guests ADD COLUMN card_downloaded BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guests' AND column_name='attended_at') THEN
        ALTER TABLE guests ADD COLUMN attended_at TIMESTAMP;
    END IF;
END $$;

-- 3. Generate QR tokens for guests without them
UPDATE guests 
SET qr_token = gen_random_uuid()::text
WHERE qr_token IS NULL OR qr_token = '';

-- 4. Create indexes (without errors)
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_guests_serial ON guests(event_id, serial);
CREATE INDEX IF NOT EXISTS idx_guests_category ON guests(category);
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);

-- 5. Create new tables (if not exist)
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

-- 6. Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_analytics ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies (drop first if exist)
DROP POLICY IF EXISTS "Users can view own events" ON events;
CREATE POLICY "Users can view own events" ON events FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own events" ON events;
CREATE POLICY "Users can create own events" ON events FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own events" ON events;
CREATE POLICY "Users can update own events" ON events FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own events" ON events;
CREATE POLICY "Users can delete own events" ON events FOR DELETE USING (auth.uid() = user_id);

-- SUCCESS!
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE '✅ ✅ ✅ SETUP COMPLETE! ✅ ✅ ✅';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'All tables and columns ready';
    RAISE NOTICE 'RLS enabled and policies created';
    RAISE NOTICE 'QR tokens generated';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Run CLEAN_WORKFLOW.sql';
    RAISE NOTICE '==========================================';
END $$;
