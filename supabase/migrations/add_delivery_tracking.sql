-- F1: إضافة تتبع وصول الرسائل (Delivery Tracking)
-- هذا يضيف أعمدة لمتابعة حالة كل رسالة: أُرسلت → وصلت → قُرأت

ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS evolution_message_id TEXT;

-- إضافة عمود reminder_sent للضيوف (للتذكير التلقائي)
ALTER TABLE guests
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- إضافة أعمدة الاستبدال للمناسبات
ALTER TABLE events
ADD COLUMN IF NOT EXISTS max_replacements INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_replacements INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replacement_done BOOLEAN DEFAULT false;

-- تعليق:
-- delivery_status القيم:
--   'sent'      = أُرسلت من السيرفر ✅
--   'delivered'  = وصلت جوال الضيف ✅✅
--   'read'       = الضيف فتحها وقرأها (العلامتين الزرق) ✅✅
--   'failed'     = فشل الإرسال ❌
