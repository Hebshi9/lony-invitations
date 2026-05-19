-- إصلاح شامل لجدول سجل الأعمال (Business Ledger)
-- إضافة جميع الأعمدة التي قد تكون ناقصة لضمان عمل النظام بالكامل

ALTER TABLE public.business_ledger 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT DEFAULT 'الراجحي',
ADD COLUMN IF NOT EXISTS expected_delivery_date TEXT,
ADD COLUMN IF NOT EXISTS estimated_marketing_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'قيد الانتظار';

-- تحديث الذاكرة المؤقتة لـ Supabase
NOTIFY pgrst, 'reload schema';
