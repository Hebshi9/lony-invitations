-- ======================================================
-- تحديث جدول events لدعم دورة RSVP المحسّنة
-- ======================================================

-- وقت إرسال الدعوات (يحسب منه البفر)
ALTER TABLE events ADD COLUMN IF NOT EXISTS invitations_sent_at TIMESTAMPTZ;

-- حالة دورة RSVP
-- idle → collecting → follow_up_sent → summary_sent → replacements_pending → replacements_done
ALTER TABLE events ADD COLUMN IF NOT EXISTS rsvp_cycle_status TEXT DEFAULT 'idle';

-- عدد البدلاء المسموح (يتحدد تلقائياً بعدد المعتذرين)
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_replacements INTEGER DEFAULT 0;

-- عدد البدلاء المستخدم
ALTER TABLE events ADD COLUMN IF NOT EXISTS used_replacements INTEGER DEFAULT 0;

-- وقت إرسال الفولو أب
ALTER TABLE events ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;

-- وقت إرسال الملخص للعميل
ALTER TABLE events ADD COLUMN IF NOT EXISTS summary_sent_at TIMESTAMPTZ;
