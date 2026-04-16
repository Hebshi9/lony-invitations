-- 1. Events Table Enhancements
ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign_progress JSONB DEFAULT '{"current_name": "", "count": 0, "total": 0}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS groom_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bride_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_time TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS meta_media_id TEXT; -- For stability pre-upload

-- 2. Guests Table Enhancements
ALTER TABLE guests ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS companions_count INTEGER DEFAULT 0;
