-- Additional constraints and improvements for features system
-- Run this after the main features migration

-- 1. Add UNIQUE constraint on token to prevent duplicates
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'events_token_unique'
    ) THEN
        ALTER TABLE events 
        ADD CONSTRAINT events_token_unique UNIQUE (token);
    END IF;
END $$;

-- 2. Add activation_time column if it doesn't exist
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS activation_time TIMESTAMPTZ;

-- 3. Add opening_time column if it doesn't exist  
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS opening_time TIMESTAMPTZ;

-- 4. Add index on features column for faster queries
CREATE INDEX IF NOT EXISTS idx_events_features 
ON events USING GIN (features);

-- 5. Add index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_events_token 
ON events (token);

-- 6. Add check constraint to ensure activation_time is before event date
ALTER TABLE events 
DROP CONSTRAINT IF EXISTS check_activation_before_event;

ALTER TABLE events 
ADD CONSTRAINT check_activation_before_event 
CHECK (activation_time IS NULL OR activation_time <= date::timestamptz);

-- 7. Create helper function to check if QR is active
CREATE OR REPLACE FUNCTION is_qr_active(
    p_event_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_event RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT features, activation_time 
    INTO v_event
    FROM events 
    WHERE id = p_event_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if time restriction is enabled
    IF (v_event.features->>'qr_time_restricted')::boolean = TRUE THEN
        -- Check if activation time has passed
        IF v_event.activation_time IS NULL OR v_now < v_event.activation_time THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to get active features count
CREATE OR REPLACE FUNCTION get_active_features_count(
    p_features JSONB
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_key TEXT;
    v_value BOOLEAN;
BEGIN
    FOR v_key, v_value IN 
        SELECT * FROM jsonb_each_text(p_features)
    LOOP
        IF v_value::boolean = TRUE THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Add comment to features column
COMMENT ON COLUMN events.features IS 
'JSONB object storing feature flags for the event. Available features: qr_time_restricted, enable_host_pin, privacy_mode, enable_simple_scan, require_inspector_app, offline_mode, live_analytics, client_dashboard, ai_rsvp_bot, whatsapp_automated, instant_notifications, custom_checkin_page, enable_categories';

-- 10. Create view for events with features summary
CREATE OR REPLACE VIEW events_with_features_summary AS
SELECT 
    id,
    name,
    token,
    date,
    activation_time,
    opening_time,
    features,
    get_active_features_count(features) as active_features_count,
    (features->>'require_inspector_app')::boolean as has_inspector,
    (features->>'enable_simple_scan')::boolean as has_preview,
    (features->>'qr_time_restricted')::boolean as is_time_restricted,
    (features->>'live_analytics')::boolean as has_analytics,
    (features->>'client_dashboard')::boolean as has_client_dashboard,
    is_qr_active(id) as qr_currently_active,
    created_at,
    updated_at
FROM events;

-- Grant permissions
GRANT SELECT ON events_with_features_summary TO authenticated;
