-- =====================================================
-- 🔧 CRITICAL FIXES - Run this NOW
-- =====================================================
-- This will fix Auth and QR issues immediately
-- =====================================================

-- 1. Generate QR tokens for all guests without them
UPDATE guests 
SET qr_token = gen_random_uuid()::text
WHERE qr_token IS NULL OR qr_token = '';

-- 2. Create test event and guest for testing
DO $$
DECLARE
    v_event_id UUID;
    v_guest_id UUID;
    v_qr_token TEXT;
BEGIN
    -- Check if test event exists
    SELECT id INTO v_event_id 
    FROM events 
    WHERE name = 'حدث تجريبي'
    LIMIT 1;
    
    -- Create if not exists
    IF v_event_id IS NULL THEN
        INSERT INTO events (name, date, venue)
        VALUES ('حدث تجريبي', CURRENT_DATE + 7, 'قاعة الاختبار')
        RETURNING id INTO v_event_id;
    END IF;
    
    -- Create test guest with QR
    v_qr_token := gen_random_uuid()::text;
    
    INSERT INTO guests (
        event_id, name, phone, qr_token,
        status, table_no, companions_count
    ) VALUES (
        v_event_id,
        'ضيف تجريبي للاختبار',
        '0500000000',
        v_qr_token,
        'confirmed',
        'A1',
        2
    ) RETURNING id INTO v_guest_id;
    
    -- Success message
    RAISE NOTICE '==========================================';
    RAISE NOTICE '✅ SUCCESS! Test data created';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Event ID: %', v_event_id;
    RAISE NOTICE 'Guest ID: %', v_guest_id;
    RAISE NOTICE 'QR Token: %', v_qr_token;
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Test URLs:';
    RAISE NOTICE 'Guest page: http://localhost:5173/v/%', v_qr_token;
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next steps:';
    RAISE NOTICE '1. Disable email confirmation in Supabase Dashboard';
    RAISE NOTICE '2. Try login with any email';
    RAISE NOTICE '3. Test QR page with URL above';
    RAISE NOTICE '==========================================';
END $$;

-- 3. Verify counts
SELECT 
    'Total events' as item,
    COUNT(*) as count
FROM events
UNION ALL
SELECT 
    'Total guests' as item,
    COUNT(*) as count
FROM guests
UNION ALL
SELECT 
    'Guests with QR' as item,
    COUNT(*) as count
FROM guests
WHERE qr_token IS NOT NULL;
