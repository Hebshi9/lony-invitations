-- Add magic_link_token field to events table for Host Portal
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS magic_link_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Create an index for faster lookups when verifying magic links
CREATE INDEX IF NOT EXISTS idx_events_magic_link_token ON events(magic_link_token);
