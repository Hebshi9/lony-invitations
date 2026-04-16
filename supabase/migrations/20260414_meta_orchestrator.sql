-- 1. Add Smart Orchestration fields to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 3; -- 1: Urgent, 2: High, 3: Normal
ALTER TABLE events ADD COLUMN IF NOT EXISTS daily_budget INTEGER DEFAULT 250;
ALTER TABLE events ADD COLUMN IF NOT EXISTS campaign_strategy TEXT DEFAULT 'round_robin'; -- 'round_robin' or 'priority_first'

-- 2. Create System Settings table for global quotas
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Initial Global Meta Quota Configuration
INSERT INTO system_settings (key, value, description)
VALUES ('meta_daily_limit', '250', 'The total messages allowed per 24 hours across all events')
ON CONFLICT (key) DO NOTHING;

-- 4. Enable Realtime for the new table
ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
