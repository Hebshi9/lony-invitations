-- Migration: Add design_config to events
-- This stores the specific visual design state for the event's invitation card

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS design_config JSONB DEFAULT '{
  "canvas": { "width": 1080, "height": 1920, "backgroundColor": "#ffffff" },
  "elements": []
}'::jsonb;

COMMENT ON COLUMN events.design_config IS 'Stores the serialized canvas state (Text, QR, Images) for the Unified Studio';
