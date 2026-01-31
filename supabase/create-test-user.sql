-- =====================================================================================================
-- 🔧 LOCAL DEV SETUP - Create Test User
-- =====================================================================================================
-- Run this in Supabase SQL Editor to create a test user without email verification
-- =====================================================================================================

-- Insert test user directly (bypasses email verification)
-- Password will be: test123

-- Note: You'll need to get the hashed password
-- For now, use Supabase Dashboard to create user manually:
-- 1. Go to Authentication → Users
-- 2. Click "Add User"
-- 3. Email: test@local.com
-- 4. Password: test123
-- 5. Auto Confirm User: YES ✅

-- Or disable email confirmation completely:
-- Authentication → Settings → Email Auth
-- → Disable "Enable email confirmations"

-- Check if auth is working:
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
