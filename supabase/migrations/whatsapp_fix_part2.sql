-- الجزء الثاني: الدوال والعرض --
-- (Part 2: Functions & Views) --
-- قم بتشغيله بعد الجزء الأول --

-- 5. Function to auto-update guest RSVP from reply
CREATE OR REPLACE FUNCTION update_guest_rsvp_from_reply()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if it's an RSVP reply with good confidence
    IF NEW.is_rsvp = TRUE AND NEW.ai_confidence >= 0.7 THEN
        UPDATE guests
        SET 
            rsvp_status = NEW.rsvp_response,
            companion_count = COALESCE(NEW.companion_count, 0),
            rsvp_notes = NEW.extracted_notes,
            rsvp_at = NEW.received_at,
            updated_at = NOW()
        WHERE id = NEW.guest_id;
        
        -- Mark reply as processed
        NEW.processed = TRUE;
        NEW.processed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_guest_rsvp ON whatsapp_replies;
CREATE TRIGGER trigger_update_guest_rsvp
    BEFORE INSERT ON whatsapp_replies
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_rsvp_from_reply();

-- 6. Function to get RSVP statistics for an event
CREATE OR REPLACE FUNCTION get_event_rsvp_stats(event_uuid UUID)
RETURNS TABLE (
    total_guests BIGINT,
    confirmed BIGINT,
    declined BIGINT,
    maybe BIGINT,
    pending BIGINT,
    total_companions BIGINT,
    response_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_guests,
        COUNT(*) FILTER (WHERE rsvp_status = 'confirmed')::BIGINT as confirmed,
        COUNT(*) FILTER (WHERE rsvp_status = 'declined')::BIGINT as declined,
        COUNT(*) FILTER (WHERE rsvp_status = 'maybe')::BIGINT as maybe,
        COUNT(*) FILTER (WHERE rsvp_status = 'pending')::BIGINT as pending,
        COALESCE(SUM(companion_count), 0)::BIGINT as total_companions,
        ROUND(
            (COUNT(*) FILTER (WHERE rsvp_status != 'pending')::NUMERIC / 
            NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 
            2
        ) as response_rate
    FROM guests
    WHERE event_id = event_uuid;
END;
$$ LANGUAGE plpgsql;

-- 7. View for easy RSVP overview
CREATE OR REPLACE VIEW event_rsvp_overview AS
SELECT 
    e.id as event_id,
    e.name as event_name,
    e.date as event_date,
    COUNT(g.id) as total_guests,
    COUNT(g.id) FILTER (WHERE g.rsvp_status = 'confirmed') as confirmed_count,
    COUNT(g.id) FILTER (WHERE g.rsvp_status = 'declined') as declined_count,
    COUNT(g.id) FILTER (WHERE g.rsvp_status = 'maybe') as maybe_count,
    COUNT(g.id) FILTER (WHERE g.rsvp_status = 'pending') as pending_count,
    COALESCE(SUM(g.companion_count), 0) as total_companions,
    COUNT(r.id) as total_replies,
    ROUND(
        (COUNT(g.id) FILTER (WHERE g.rsvp_status != 'pending')::NUMERIC / 
        NULLIF(COUNT(g.id)::NUMERIC, 0)) * 100, 
        2
    ) as response_rate
FROM events e
LEFT JOIN guests g ON e.id = g.event_id
LEFT JOIN whatsapp_replies r ON g.id = r.guest_id
GROUP BY e.id, e.name, e.date;
