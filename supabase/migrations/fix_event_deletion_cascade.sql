-- إصلاح مشكلة فشل حذف المناسبات بسبب وجود ضيوف مرتبطة بها
-- هذا السكربت يضيف خاصية الحذف التلقائي (Cascade)

-- 1. معالجة جدول الضيوف (Guests)
ALTER TABLE public.guests 
DROP CONSTRAINT IF EXISTS guests_event_id_fkey;

ALTER TABLE public.guests 
ADD CONSTRAINT guests_event_id_fkey 
FOREIGN KEY (event_id) 
REFERENCES public.events(id) 
ON DELETE CASCADE;

-- 2. معالجة جدول عمليات المسح (Scans)
ALTER TABLE public.scans 
DROP CONSTRAINT IF EXISTS scans_event_id_fkey;

ALTER TABLE public.scans 
ADD CONSTRAINT scans_event_id_fkey 
FOREIGN KEY (event_id) 
REFERENCES public.events(id) 
ON DELETE CASCADE;

-- 3. معالجة جدول رسائل الواتساب (whatsapp_messages)
ALTER TABLE public.whatsapp_messages 
DROP CONSTRAINT IF EXISTS whatsapp_messages_event_id_fkey;

ALTER TABLE public.whatsapp_messages 
ADD CONSTRAINT whatsapp_messages_event_id_fkey 
FOREIGN KEY (event_id) 
REFERENCES public.events(id) 
ON DELETE CASCADE;

-- تحديث الـ Schema Cache
NOTIFY pgrst, 'reload schema';
