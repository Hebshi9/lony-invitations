-- Migration: Add WiFi and Location fields to events table
-- Date: 2026-01-29
-- Purpose: Support WiFi QR codes and Google Maps integration

-- Add WiFi fields
ALTER TABLE events
ADD COLUMN IF NOT EXISTS wifi_ssid TEXT,
ADD COLUMN IF NOT EXISTS wifi_password TEXT,
ADD COLUMN IF NOT EXISTS wifi_security TEXT CHECK (wifi_security IN ('WPA', 'WEP', 'nopass')) DEFAULT 'WPA',
ADD COLUMN IF NOT EXISTS wifi_hidden BOOLEAN DEFAULT FALSE;

-- Add location fields
ALTER TABLE events
ADD COLUMN IF NOT EXISTS location_maps_url TEXT,
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);

-- Add RSVP timestamp field to guests table
ALTER TABLE guests
ADD COLUMN IF NOT EXISTS rsvp_received_at TIMESTAMP;

-- Add card_sent flag to track if personalized card was sent
ALTER TABLE guests
ADD COLUMN IF NOT EXISTS card_sent BOOLEAN DEFAULT FALSE;

-- Create index for faster RSVP queries
CREATE INDEX IF NOT EXISTS idx_guests_rsvp_status ON guests(rsvp_status);
CREATE INDEX IF NOT EXISTS idx_guests_card_sent ON guests(card_sent);

-- Add comments for documentation
COMMENT ON COLUMN events.wifi_ssid IS 'WiFi network name for event venue';
COMMENT ON COLUMN events.wifi_password IS 'WiFi password for event venue';
COMMENT ON COLUMN events.wifi_security IS 'WiFi security type: WPA, WEP, or nopass';
COMMENT ON COLUMN events.wifi_hidden IS 'Whether WiFi network is hidden';
COMMENT ON COLUMN events.location_maps_url IS 'Google Maps URL for event location';
COMMENT ON COLUMN events.location_lat IS 'Latitude coordinate for event location';
COMMENT ON COLUMN events.location_lng IS 'Longitude coordinate for event location';
COMMENT ON COLUMN guests.rsvp_received_at IS 'Timestamp when RSVP was received';
COMMENT ON COLUMN guests.card_sent IS 'Whether personalized invitation card was sent to guest';
