-- Migration: Add QR Code Time-Based Activation
-- Date: 2026-01-29
-- Purpose: Add activation window for QR codes with start/end dates

-- Add activation fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS qr_active_from TIMESTAMP,
ADD COLUMN IF NOT EXISTS qr_active_until TIMESTAMP,
ADD COLUMN IF NOT EXISTS qr_activation_enabled BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN events.qr_active_from IS 'QR codes become active from this date/time';
COMMENT ON COLUMN events.qr_active_until IS 'QR codes expire after this date/time';
COMMENT ON COLUMN events.qr_activation_enabled IS 'Whether to enforce QR activation window';

-- Example: Set activation window for an event
-- UPDATE events 
-- SET qr_activation_enabled = TRUE,
--     qr_active_from = '2026-02-15 18:00:00',
--     qr_active_until = '2026-02-16 18:00:00'
-- WHERE id = 'your-event-id';
