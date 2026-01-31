-- Phase 3 Schema Updates

-- 1. Update Guests Table
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS remaining_companions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS qr_token TEXT DEFAULT gen_random_uuid()::text,
ADD COLUMN IF NOT EXISTS card_url TEXT;

-- Ensure qr_token is unique (if not already)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'guests_qr_token_key') THEN
        ALTER TABLE guests ADD CONSTRAINT guests_qr_token_key UNIQUE (qr_token);
    END IF;
END $$;

-- 2. Update Events Table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
    "qr_fields": {
        "show_name": true,
        "show_table": true,
        "show_companions": true,
        "show_category": false,
        "show_custom": []
    },
    "portal_settings": {}
}'::jsonb;

-- 3. Create Guest Activity Logs Table
CREATE TABLE IF NOT EXISTS guest_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    scan_type TEXT CHECK (scan_type IN ('entry', 'exit', 'info')),
    status TEXT CHECK (status IN ('success', 'failed', 'warning')),
    scanned_by UUID, -- Nullable for now, can link to auth.users
    device_info JSONB DEFAULT '{}'::jsonb,
    companions_admitted INTEGER DEFAULT 0,
    failure_reason TEXT
);

-- 4. RLS Policies for Activity Logs
ALTER TABLE guest_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (staff/admins) to insert logs
CREATE POLICY "Enable insert for authenticated users only" ON guest_activity_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to read logs for events (simplified for now to all authenticated users)
-- In a real multi-tenant app, we would link events to users via a team or user_id
CREATE POLICY "Enable read for authenticated users" ON guest_activity_logs
    FOR SELECT USING (auth.role() = 'authenticated');
