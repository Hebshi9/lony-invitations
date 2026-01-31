-- =====================================================================================================
-- 🔍 DIAGNOSTIC - Check System Status
-- =====================================================================================================
-- Run this to see the exact problem
-- =====================================================================================================

-- 1. Check if guests table exists and has qr_token
SELECT 
    COUNT(*) as total_guests,
    COUNT(qr_token) as guests_with_qr,
    COUNT(*) - COUNT(qr_token) as guests_without_qr
FROM guests;

-- 2. Sample guests with their tokens
SELECT 
    id,
    name,
    qr_token,
    event_id,
    created_at
FROM guests
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check events
SELECT 
    id,
    name,
    date,
    user_id,
    created_at
FROM events
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check auth users
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================================================================
-- 🔧 FIX #1: Generate QR Tokens for all guests
-- =====================================================================================================

UPDATE guests 
SET qr_token = gen_random_uuid()::text
WHERE qr_token IS NULL OR qr_token = '';

-- Verify fix:
SELECT COUNT(*) as fixed_count FROM guests WHERE qr_token IS NOT NULL;

-- =====================================================================================================
-- 🔧 FIX #2: Create a test guest with QR
-- =====================================================================================================

-- First, get an event_id (or create one)
DO $$
DECLARE
    v_event_id UUID;
    v_guest_id UUID;
    v_qr_token TEXT;
BEGIN
    -- Get or create test event
    SELECT id INTO v_event_id FROM events LIMIT 1;
    
    IF v_event_id IS NULL THEN
        INSERT INTO events (name, date, venue)
        VALUES ('Test Event', CURRENT_DATE + 7, 'Test Venue')
        RETURNING id INTO v_event_id;
    END IF;
    
    -- Create test guest with QR
    v_qr_token := gen_random_uuid()::text;
    
    INSERT INTO guests (
        event_id,
        name,
        phone,
        qr_token,
        status,
        table_no,
        companions_count
    ) VALUES (
        v_event_id,
        'ضيف تجريبي',
        '0500000000',
        v_qr_token,
        'confirmed',
        'A1',
        2
    ) RETURNING id INTO v_guest_id;
    
    RAISE NOTICE '✅ Test guest created!';
    RAISE NOTICE 'Guest ID: %', v_guest_id;
    RAISE NOTICE 'QR Token: %', v_qr_token;
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Test URL:';
    RAISE NOTICE 'http://localhost:5173/v/%', v_qr_token;
END $$;
