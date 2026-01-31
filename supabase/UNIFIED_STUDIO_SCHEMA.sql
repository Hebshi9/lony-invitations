-- =====================================================================================================
-- 🚀 Unified Invitation Studio - Database Schema Updates
-- =====================================================================================================
-- يضيف الحقول المطلوبة لنظام الاستوديو الموحد
-- =====================================================================================================

-- =====================================================================================================
-- PART 1: تحديث جدول EVENTS - إضافة Location & WiFi
-- =====================================================================================================

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_maps_url TEXT,
ADD COLUMN IF NOT EXISTS wifi_ssid TEXT,
ADD COLUMN IF NOT EXISTS wifi_password TEXT,
ADD COLUMN IF NOT EXISTS wifi_security TEXT CHECK (wifi_security IN ('WPA', 'WEP', 'nopass'));

-- Index للموقع
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location_lat, location_lng);

COMMENT ON COLUMN events.location_lat IS 'خط العرض (Latitude) لموقع الفعالية';
COMMENT ON COLUMN events.location_lng IS 'خط الطول (Longitude) لموقع الفعالية';
COMMENT ON COLUMN events.location_maps_url IS 'رابط Google Maps المباشر';
COMMENT ON COLUMN events.wifi_ssid IS 'اسم شبكة WiFi في الفعالية';
COMMENT ON COLUMN events.wifi_password IS 'كلمة مرور الـ WiFi';
COMMENT ON COLUMN events.wifi_security IS 'نوع تشفير WiFi (WPA/WEP/nopass)';

-- =====================================================================================================
-- PART 2: تحديث جدول GUESTS - إضافة حقول متقدمة
-- =====================================================================================================

ALTER TABLE guests
ADD COLUMN IF NOT EXISTS serial TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS card_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS card_downloaded BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP;

-- Unique constraint على Serial per Event
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_event_serial'
  ) THEN
    ALTER TABLE guests 
    ADD CONSTRAINT unique_event_serial UNIQUE(event_id, serial);
  END IF;
END $$;

-- Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_guests_serial ON guests(event_id, serial);
CREATE INDEX IF NOT EXISTS idx_guests_category ON guests(category);
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);

COMMENT ON COLUMN guests.serial IS 'رقم تسلسلي فريد للضيف (يمكن أن يكون 001، VIP-123، إلخ)';
COMMENT ON COLUMN guests.category IS 'فئة الضيف (VIP، عام، رجال، نساء، إلخ)';
COMMENT ON COLUMN guests.card_generated IS 'هل تم توليد البطاقة؟';
COMMENT ON COLUMN guests.card_downloaded IS 'هل تم تحميل البطاقة؟';
COMMENT ON COLUMN guests.attended_at IS 'تاريخ ووقت الحضور الفعلي';

-- =====================================================================================================
-- PART 3: جدول Card Templates (اختياري - للمستقبل)
-- =====================================================================================================

CREATE TABLE IF NOT EXISTS card_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,  -- wedding, graduation, conference, general
    thumbnail_url TEXT,
    background_url TEXT,
    
    -- Canvas Elements (JSON)
    canvas_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Default Settings
    default_settings JSONB DEFAULT '{
      "colors": ["#000000", "#D4AF37"],
      "fonts": ["Amiri", "Cairo"]
    }'::jsonb,
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    
    -- Usage Stats
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON card_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON card_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_active ON card_templates(is_active);

COMMENT ON TABLE card_templates IS 'قوالب البطاقات الجاهزة (للاستخدام المستقبلي)';

-- =====================================================================================================
-- PART 4: جدول Saved Styles (أنماط محفوظة)
-- =====================================================================================================

CREATE TABLE IF NOT EXISTS saved_styles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,  -- للمستقبل: ربط بالمستخدمين
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('text', 'qr')),
    properties JSONB NOT NULL,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_styles_user ON saved_styles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_styles_type ON saved_styles(type);

COMMENT ON TABLE saved_styles IS 'الأنماط المحفوظة (نصوص وQR) للاستخدام السريع';

-- =====================================================================================================
-- PART 5: جدول Export Jobs (وظائف التصدير)
-- =====================================================================================================

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    
    -- Export Settings
    format TEXT NOT NULL CHECK (format IN ('zip', 'pdf', 'png')),  -- ZIP, PDF, PNG
    quality TEXT DEFAULT 'high' CHECK (quality IN ('low', 'medium', 'high', 'ultra')),
    size_width INTEGER DEFAULT 1080,
    size_height INTEGER DEFAULT 1920,
    
    -- Range (للتصدير الجزئي)
    guest_range_start INTEGER,
    guest_range_end INTEGER,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress INTEGER DEFAULT 0,  -- 0-100
    total_cards INTEGER,
    
    -- Output
    download_url TEXT,
    file_size_mb DECIMAL(10, 2),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Error Handling
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_event ON export_jobs(event_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created ON export_jobs(created_at DESC);

COMMENT ON TABLE export_jobs IS 'سجل وظائف التصدير (ZIP/PDF/PNG)';
COMMENT ON COLUMN export_jobs.format IS 'صيغة التصدير: zip (مضغوط), pdf (ملف واحد), png (صور فردية)';
COMMENT ON COLUMN export_jobs.quality IS 'جودة الصور: low (معاينة), medium, high (طباعة), ultra (HD)';
COMMENT ON COLUMN export_jobs.guest_range_start IS 'بداية النطاق للتصدير الجزئي (اختياري)';
COMMENT ON COLUMN export_jobs.guest_range_end IS 'نهاية النطاق للتصدير الجزئي (اختياري)';

-- =====================================================================================================
-- PART 6: Analytics (إحصائيات الاستخدام)
-- =====================================================================================================

CREATE TABLE IF NOT EXISTS card_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL CHECK (event_type IN ('viewed', 'downloaded', 'scanned', 'shared')),
    event_data JSONB,
    
    -- Tracking
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_guest ON card_analytics(guest_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON card_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON card_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON card_analytics(created_at DESC);

COMMENT ON TABLE card_analytics IS 'تتبع الأحداث: عرض، تحميل، مسح، مشاركة';

-- =====================================================================================================
-- PART 7: Triggers للـ card_templates
-- =====================================================================================================

DROP TRIGGER IF EXISTS update_card_templates_updated_at ON card_templates;
CREATE TRIGGER update_card_templates_updated_at 
BEFORE UPDATE ON card_templates 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================================
-- PART 8: RLS Policies للجداول الجديدة
-- =====================================================================================================

ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_analytics ENABLE ROW LEVEL SECURITY;

-- Policies - Public Access (نفس نهج الجداول الأخرى)
CREATE POLICY "Allow public card_templates read" 
ON card_templates FOR SELECT TO public USING (true);

CREATE POLICY "Allow public card_templates insert" 
ON card_templates FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public card_templates update" 
ON card_templates FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public saved_styles read" 
ON saved_styles FOR SELECT TO public USING (true);

CREATE POLICY "Allow public saved_styles insert" 
ON saved_styles FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public export_jobs read" 
ON export_jobs FOR SELECT TO public USING (true);

CREATE POLICY "Allow public export_jobs insert" 
ON export_jobs FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public export_jobs update" 
ON export_jobs FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public card_analytics insert" 
ON card_analytics FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public card_analytics read" 
ON card_analytics FOR SELECT TO public USING (true);

-- =====================================================================================================
-- PART 9: Helper Functions
-- =====================================================================================================

-- دالة لتوليد أرقام تسلسلية
CREATE OR REPLACE FUNCTION generate_serial_numbers(
    p_event_id UUID,
    p_count INTEGER,
    p_start_from INTEGER DEFAULT 1,
    p_prefix TEXT DEFAULT '',
    p_padding_length INTEGER DEFAULT 3
)
RETURNS TABLE (serial TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN p_prefix = '' THEN LPAD((p_start_from + gs.n - 1)::TEXT, p_padding_length, '0')
            ELSE p_prefix || LPAD((p_start_from + gs.n - 1)::TEXT, p_padding_length, '0')
        END
    FROM generate_series(1, p_count) gs(n);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_serial_numbers IS 'توليد أرقام تسلسلية مع بادئة اختيارية';

-- مثال استخدام:
-- SELECT * FROM generate_serial_numbers('event-uuid'::uuid, 100, 1, 'VIP-', 3);
-- النتيجة: VIP-001, VIP-002, ..., VIP-100

-- =====================================================================================================
-- ✅ التحقق من النجاح
-- =====================================================================================================

SELECT 
    '✅ تم تحديث Schema بنجاح!' as message,
    'تمت إضافة:' as details,
    '- حقول Location & WiFi للفعاليات' as item1,
    '- حقول Serial & Category للضيوف' as item2,
    '- جدول card_templates' as item3,
    '- جدول saved_styles' as item4,
    '- جدول export_jobs' as item5,
    '- جدول card_analytics' as item6,
    '- دالة generate_serial_numbers()' as item7;

-- عرض الحقول الجديدة
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name IN ('events', 'guests')
AND column_name IN (
    'location_lat', 'location_lng', 'location_maps_url',
    'wifi_ssid', 'wifi_password', 'wifi_security',
    'serial', 'category', 'card_generated', 'card_downloaded', 'attended_at'
)
ORDER BY table_name, column_name;

-- =====================================================================================================
-- 🎉 انتهى!
-- =====================================================================================================
