-- Add demo support columns to guests table

-- Add is_demo column to mark demo guests
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;

-- Add demo_state to track which state this demo represents
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS demo_state VARCHAR(20);

-- Add index for faster demo guest queries
CREATE INDEX IF NOT EXISTS idx_guests_is_demo 
ON guests (event_id, is_demo) 
WHERE is_demo = TRUE;

-- Add check constraint for demo_state
ALTER TABLE guests 
DROP CONSTRAINT IF EXISTS check_demo_state;

ALTER TABLE guests 
ADD CONSTRAINT check_demo_state 
CHECK (
    demo_state IS NULL 
    OR demo_state IN ('before', 'during', 'after')
);

-- Function to auto-create demo guests when event is created
CREATE OR REPLACE FUNCTION create_demo_guests_for_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create demo guests if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM guests 
        WHERE event_id = NEW.id AND is_demo = TRUE
    ) THEN
        -- Insert 3 demo guests
        INSERT INTO guests (
            event_id, 
            name, 
            phone, 
            table_no, 
            is_demo, 
            demo_state,
            status,
            companions_count,
            card_generated
        ) VALUES
        (
            NEW.id,
            'عينة - قبل المناسبة',
            '+966500000001',
            'DEMO-1',
            TRUE,
            'before',
            'pending',
            2,
            FALSE
        ),
        (
            NEW.id,
            'عينة - أثناء المناسبة',
            '+966500000002',
            'DEMO-2',
            TRUE,
            'during',
            'confirmed',
            3,
            FALSE
        ),
        (
            NEW.id,
            'عينة - بعد المناسبة',
            '+966500000003',
            'DEMO-3',
            TRUE,
            'after',
            'attended',
            1,
            FALSE
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create demo guests
DROP TRIGGER IF EXISTS trigger_create_demo_guests ON events;

CREATE TRIGGER trigger_create_demo_guests
    AFTER INSERT ON events
    FOR EACH ROW
    EXECUTE FUNCTION create_demo_guests_for_event();

-- Function to get only real guests (exclude demos)
CREATE OR REPLACE FUNCTION get_real_guests(p_event_id UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    phone VARCHAR,
    table_no VARCHAR,
    status VARCHAR,
    companions_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        g.id,
        g.name,
        g.phone,
        g.table_no,
        g.status,
        g.companions_count
    FROM guests g
    WHERE g.event_id = p_event_id
    AND (g.is_demo = FALSE OR g.is_demo IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_real_guests(UUID) TO authenticated;

-- Add comment
COMMENT ON COLUMN guests.is_demo IS 'TRUE if this is a demo guest for client preview, FALSE for real guests';
COMMENT ON COLUMN guests.demo_state IS 'The state this demo represents: before, during, or after the event';
