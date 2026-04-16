-- Migration: Smart Progress & Professional Fields
-- Adds fields for real-time campaign tracking and reporting

-- 1. Add fields to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign_progress JSONB DEFAULT '{"current_name": "", "count": 0, "total": 0}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_phone TEXT;

-- 2. Variables for Meta Templates (Ensuring they exist for the orchestrator)
ALTER TABLE events ADD COLUMN IF NOT EXISTS groom_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bride_name TEXT;

-- 3. Enable Realtime for events to catch progress updates immediately
ALTER PUBLICATION supabase_realtime ADD TABLE events;
