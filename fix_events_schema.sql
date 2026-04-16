-- كود إصلاح قاعدة البيانات: إضافة الأعمدة الناقصة لجدول المناسبات (events)
-- قم بنسخ هذا الكود وتشغيله في Supabase SQL Editor

-- 1. إضافة أعمدة الأسماء (العريس والعروس)
ALTER TABLE events ADD COLUMN IF NOT EXISTS groom_name TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS bride_name TEXT;

-- 2. إضافة أعمدة التحكم بالأمان (Host PIN)
ALTER TABLE events ADD COLUMN IF NOT EXISTS host_pin TEXT;

-- 3. إضافة أعمدة التوقيت وتفعيل الباركود
ALTER TABLE events ADD COLUMN IF NOT EXISTS activation_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS opening_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_active_from TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_active_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_activation_enabled BOOLEAN DEFAULT FALSE;

-- 4. إضافة أعمدة الإعدادات والخصائص (إذا لم تكن موجودة)
ALTER TABLE events ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Saudi Arabia';
ALTER TABLE events ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- ملاحظة: سوبا بيز سيقوم بتحديث الـ Cache تلقائياً بعد التشغيل
