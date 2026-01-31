-- ===================================
-- Complete Database Schema Update
-- ===================================

-- 1. Add missing columns to guests table
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS card_image_url TEXT,
ADD COLUMN IF NOT EXISTS card_number VARCHAR(10),
ADD COLUMN IF NOT EXISTS card_generated_at TIMESTAMPTZ;

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_guests_card_image_url ON guests(card_image_url) WHERE card_image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_card_number ON guests(card_number);

-- 3. Add comment for documentation
COMMENT ON COLUMN guests.card_image_url IS 'Public URL of the generated invitation card image stored in Supabase Storage';
COMMENT ON COLUMN guests.card_number IS 'Sequential card number (001, 002, etc.) for tracking and organization';
COMMENT ON COLUMN guests.card_generated_at IS 'Timestamp when the card was generated and uploaded';

-- 4. Update existing guests with card numbers (if needed)
DO $$
DECLARE
    event_record RECORD;
    guest_record RECORD;
    counter INTEGER;
BEGIN
    FOR event_record IN SELECT DISTINCT event_id FROM guests WHERE card_number IS NULL
    LOOP
        counter := 1;
        FOR guest_record IN 
            SELECT id FROM guests 
            WHERE event_id = event_record.event_id 
            AND card_number IS NULL
            ORDER BY created_at, serial, name
        LOOP
            UPDATE guests 
            SET card_number = LPAD(counter::TEXT, 3, '0')
            WHERE id = guest_record.id;
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- 5. Verify the changes
SELECT 
    COUNT(*) as total_guests,
    COUNT(card_image_url) as guests_with_cards,
    COUNT(card_number) as guests_with_numbers
FROM guests;
