-- إضافة الحقول الجديدة لجدول سجل الأعمال (الفاينانس)
ALTER TABLE public.business_ledger 
ADD COLUMN IF NOT EXISTS bank_account TEXT DEFAULT 'الراجحي',
ADD COLUMN IF NOT EXISTS expected_delivery_date TEXT,
ADD COLUMN IF NOT EXISTS estimated_marketing_cost NUMERIC DEFAULT 0;

-- في حال لم يكن حقل deposit_amount موجوداً من قبل
ALTER TABLE public.business_ledger 
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0;

-- تحديث الـ Schema Cache في Supabase حتى تظهر الأعمدة الجديدة فوراً
NOTIFY pgrst, 'reload schema';
