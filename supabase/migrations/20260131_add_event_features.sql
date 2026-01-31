-- Migration: Add features column to events table
-- This allows flexible feature selection per event

-- Add features column if it doesn't exist
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{
  "qr_time_restricted": false,
  "enable_simple_scan": false,
  "require_inspector_app": false,
  "enable_host_pin": false,
  "live_analytics": false,
  "client_dashboard": false,
  "ai_rsvp_bot": false,
  "instant_notifications": false,
  "offline_mode": false,
  "whatsapp_automated": false,
  "custom_checkin_page": false,
  "enable_categories": false,
  "privacy_mode": false
}'::jsonb;

-- Add index for faster feature queries
CREATE INDEX IF NOT EXISTS idx_events_features ON events USING GIN (features);

-- Helper function to check if a feature is enabled
CREATE OR REPLACE FUNCTION has_feature(event_id UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  result BOOLEAN;
BEGIN
  SELECT COALESCE((features->>feature_name)::boolean, false)
  INTO result
  FROM events
  WHERE id = event_id;
  
  RETURN COALESCE(result, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to enable/disable feature
CREATE OR REPLACE FUNCTION set_feature(event_id UUID, feature_name TEXT, enabled BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE events
  SET features = jsonb_set(
    COALESCE(features, '{}'::jsonb),
    ARRAY[feature_name],
    to_jsonb(enabled)
  )
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN events.features IS 'Optional add-on features per event (paid/premium features)';
COMMENT ON FUNCTION has_feature IS 'Check if a specific feature is enabled for an event';
COMMENT ON FUNCTION set_feature IS 'Enable or disable a feature for an event';
