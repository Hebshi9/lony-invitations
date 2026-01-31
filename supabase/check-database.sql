-- ========================================
-- 🔍 سكريبت التحقق من قاعدة البيانات
-- ========================================
-- شغّل هذا في Supabase SQL Editor للتحقق

-- ========================================
-- 1️⃣ التحقق من الأعمدة
-- ========================================

-- أعمدة جدول EVENTS
SELECT 
    '--- EVENTS TABLE ---' as info,
    column_name, 
    data_type,
    CASE WHEN is_nullable = 'YES' THEN '✓ Nullable' ELSE '✗ NOT NULL' END as nullable
FROM information_schema.columns 
WHERE table_name = 'events' 
ORDER BY ordinal_position;

-- أعمدة جدول GUESTS
SELECT 
    '--- GUESTS TABLE ---' as info,
    column_name, 
    data_type,
    CASE WHEN is_nullable = 'YES' THEN '✓ Nullable' ELSE '✗ NOT NULL' END as nullable
FROM information_schema.columns 
WHERE table_name = 'guests' 
ORDER BY ordinal_position;

-- أعمدة جدول SCANS
SELECT 
    '--- SCANS TABLE ---' as info,
    column_name, 
    data_type,
    CASE WHEN is_nullable = 'YES' THEN '✓ Nullable' ELSE '✗ NOT NULL' END as nullable
FROM information_schema.columns 
WHERE table_name = 'scans' 
ORDER BY ordinal_position;

-- ========================================
-- 2️⃣ التحقق من RLS
-- ========================================

SELECT 
    '--- RLS STATUS ---' as info,
    tablename,
    CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('events', 'guests', 'scans', 'users')
ORDER BY tablename;

-- ========================================
-- 3️⃣ التحقق من السياسات (Policies)
-- ========================================

SELECT 
    '--- POLICIES ---' as info,
    tablename,
    policyname,
    cmd as operation,
    roles,
    CASE WHEN permissive = 'PERMISSIVE' THEN '✓' ELSE 'RESTRICTIVE' END as type
FROM pg_policies
WHERE tablename IN ('events', 'guests', 'scans')
ORDER BY tablename, cmd;

-- ========================================
-- 4️⃣ عدد السجلات
-- ========================================

SELECT 
    '--- RECORDS COUNT ---' as info,
    'events' as table_name,
    COUNT(*) as count
FROM events
UNION ALL
SELECT 
    '--- RECORDS COUNT ---',
    'guests',
    COUNT(*)
FROM guests
UNION ALL
SELECT 
    '--- RECORDS COUNT ---',
    'scans',
    COUNT(*)
FROM scans;

-- ========================================
-- 5️⃣ التحقق من القيود (Constraints)
-- ========================================

SELECT 
    '--- CONSTRAINTS ---' as info,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name IN ('events', 'guests', 'scans')
ORDER BY tc.table_name, tc.constraint_type;

-- ========================================
-- 6️⃣ الأعمدة الناقصة المتوقعة
-- ========================================

-- فحص إذا كانت الأعمدة الجديدة موجودة
SELECT 
    '--- MISSING COLUMNS CHECK ---' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'client_id'
        ) THEN '✅ events.client_id EXISTS'
        ELSE '❌ events.client_id MISSING'
    END as status
UNION ALL
SELECT 
    '--- MISSING COLUMNS CHECK ---',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'events' AND column_name = 'start_date'
        ) THEN '✅ events.start_date EXISTS'
        ELSE '❌ events.start_date MISSING'
    END
UNION ALL
SELECT 
    '--- MISSING COLUMNS CHECK ---',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'guests' AND column_name = 'companions_count'
        ) THEN '✅ guests.companions_count EXISTS'
        ELSE '❌ guests.companions_count MISSING'
    END
UNION ALL
SELECT 
    '--- MISSING COLUMNS CHECK ---',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'guests' AND column_name = 'max_scans'
        ) THEN '✅ guests.max_scans EXISTS'
        ELSE '❌ guests.max_scans MISSING'
    END
UNION ALL
SELECT 
    '--- MISSING COLUMNS CHECK ---',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'scans' AND column_name = 'scan_result'
        ) THEN '✅ scans.scan_result EXISTS'
        ELSE '❌ scans.scan_result MISSING'
    END;

-- ========================================
-- 7️⃣ السياسات المطلوبة
-- ========================================

SELECT 
    '--- REQUIRED POLICIES CHECK ---' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'guests' AND cmd = 'SELECT'
        ) THEN '✅ guests SELECT policy EXISTS'
        ELSE '❌ guests SELECT policy MISSING'
    END as status
UNION ALL
SELECT 
    '--- REQUIRED POLICIES CHECK ---',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'guests' AND cmd = 'UPDATE'
        ) THEN '✅ guests UPDATE policy EXISTS'
        ELSE '❌ guests UPDATE policy MISSING'
    END
UNION ALL
SELECT 
    '--- REQUIRED POLICIES CHECK ---',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'scans' AND cmd = 'SELECT'
        ) THEN '✅ scans SELECT policy EXISTS'
        ELSE '❌ scans SELECT policy MISSING'
    END
UNION ALL
SELECT 
    '--- REQUIRED POLICIES CHECK ---',
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'scans' AND cmd = 'INSERT'
        ) THEN '✅ scans INSERT policy EXISTS'
        ELSE '❌ scans INSERT policy MISSING'
    END;

-- ========================================
-- ✅ انتهى التحقق
-- ========================================
