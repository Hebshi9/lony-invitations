-- إضافة الأعمدة الناقصة لجدول events
-- (Add missing columns to events table)

-- Event Timing & Packages
ALTER TABLE events ADD COLUMN IF NOT EXISTS activation_time TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS opening_time TIMESTAMP;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'SA';

-- Event Packages (Standard/Premium)
ALTER TABLE events ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'premium';
ALTER TABLE events ADD COLUMN IF NOT EXISTS host_pin TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS enable_simple_scan BOOLEAN DEFAULT false;

-- Guest Custom Fields Support
ALTER TABLE guests ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Create Index
CREATE INDEX IF NOT EXISTS idx_events_activation ON events(activation_time);
CREATE INDEX IF NOT EXISTS idx_events_package ON events(package_type);

-- SUCCESS
DO $$
BEGIN
    RAISE NOTICE '✅ Event timing and package columns added successfully!';
END $$;
