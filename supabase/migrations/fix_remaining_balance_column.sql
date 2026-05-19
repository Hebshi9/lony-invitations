-- حل مشكلة "cannot insert a non-DEFAULT value into column remaining_balance"
-- هذا السكربت يحول العمود لعمود عادي يقبل الإدخال من الموقع

-- 1. حذف العمود الحالي (لتنظيف أي إعدادات قديمة تمنع الإدخال)
ALTER TABLE public.business_ledger DROP COLUMN IF EXISTS remaining_balance;

-- 2. إعادة إنشاء العمود كعمود رقمي عادي
ALTER TABLE public.business_ledger ADD COLUMN remaining_balance NUMERIC DEFAULT 0;

-- تحديث الذاكرة المؤقتة لـ Supabase
NOTIFY pgrst, 'reload schema';
