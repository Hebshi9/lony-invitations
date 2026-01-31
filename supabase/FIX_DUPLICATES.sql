-- =====================================================
-- 🔧 FIX DUPLICATE SERIALS - Run this FIRST
-- =====================================================
-- This removes duplicate serial entries before creating the constraint
-- =====================================================

-- 1. Find and show duplicates (for verification)
SELECT 
    event_id, 
    serial, 
    COUNT(*) as duplicate_count,
    array_agg(id) as guest_ids
FROM guests
WHERE serial IS NOT NULL
GROUP BY event_id, serial
HAVING COUNT(*) > 1;

-- 2. Keep only the FIRST occurrence of each duplicate
-- Delete all others
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY event_id, serial 
            ORDER BY created_at ASC
        ) as rn
    FROM guests
    WHERE serial IS NOT NULL
)
DELETE FROM guests
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- 3. NOW you can run COMPLETE_SETUP.sql without errors!

-- Verification
SELECT 
    'Total guests after cleanup' as info,
    COUNT(*) as count
FROM guests;
