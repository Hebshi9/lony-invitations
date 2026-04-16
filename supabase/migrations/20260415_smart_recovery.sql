-- Migration: Add Smart Recovery columns to whatsapp_messages
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'marketing';
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'meta';

-- Create index for the recovery engine to find scheduled messages efficiently
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_scheduled ON whatsapp_messages (scheduled_at) 
WHERE status = 'scheduled' OR status = 'pending_recovery';

-- Update guests table to support tracking recovery attempts if needed
ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_error_code TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS recovery_strategy TEXT; -- 'delay' or 'bridge'
