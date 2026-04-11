-- إضافة دعم لمزود Meta الرسمي في جدول الحسابات
DO $$ 
BEGIN
    -- 1. إضافة نوع المزود (Provider Type)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'provider') THEN
        ALTER TABLE whatsapp_accounts ADD COLUMN provider TEXT DEFAULT 'evolution';
    END IF;

    -- 2. إضافة حقول Meta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'meta_phone_number_id') THEN
        ALTER TABLE whatsapp_accounts ADD COLUMN meta_phone_number_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'meta_waba_id') THEN
        ALTER TABLE whatsapp_accounts ADD COLUMN meta_waba_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'meta_access_token') THEN
        ALTER TABLE whatsapp_accounts ADD COLUMN meta_access_token TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'meta_verify_token') THEN
        ALTER TABLE whatsapp_accounts ADD COLUMN meta_verify_token TEXT;
    END IF;

    -- 3. إضافة حقل لإحصائيات Meta (Limit Tracking)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_accounts' AND column_name = 'meta_daily_limit') THEN
        ALTER TABLE whatsapp_accounts ADD COLUMN meta_daily_limit INTEGER DEFAULT 250;
    END IF;
END $$;
