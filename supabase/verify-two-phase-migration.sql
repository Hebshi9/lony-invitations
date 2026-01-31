-- ✅ Quick Verification After Migration
-- Run these queries to confirm everything is set up correctly

-- 1. Check message_phase column exists
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'whatsapp_messages' 
AND column_name = 'message_phase';
-- Expected: 1 row showing message_phase column

-- 2. Check new guest columns exist
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'guests' 
AND column_name IN ('whatsapp_rsvp_status', 'whatsapp_rsvp_at')
ORDER BY column_name;
-- Expected: 2 rows

-- 3. Check view exists and works
SELECT 
    guest_name,
    phone,
    whatsapp_rsvp_status,
    general_invitation_sent,
    personalized_card_sent,
    invitation_status
FROM whatsapp_confirmation_status
LIMIT 5;
-- Expected: List of guests with their status

-- 4. Check index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'whatsapp_messages' 
AND indexname = 'idx_whatsapp_messages_phase';
-- Expected: 1 row showing the index

-- ✅ If all queries return results, migration is successful!
