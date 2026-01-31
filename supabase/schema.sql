-- Events Table (المناسبات)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    location TEXT,
    client_id TEXT NOT NULL, -- معرف العميل (يمكن أن يكون email أو UUID)
    client_access_code TEXT, -- كود وصول خاص للعميل
    start_date TIMESTAMP, -- تاريخ بداية المناسبة
    end_date TIMESTAMP, -- تاريخ انتهاء المناسبة (لمنع الدخول بعدها)
    scan_config JSONB, -- إعدادات عرض الماسح الضوئي
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Guests Table (الضيوف)
CREATE TABLE IF NOT EXISTS guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    serial TEXT UNIQUE, -- رقم تسلسلي فريد
    qr_payload TEXT UNIQUE NOT NULL, -- محتوى الباركود (UUID فريد)
    table_no TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'attended', 'cancelled'
    rsvp_status TEXT DEFAULT 'pending',
    companions_count INTEGER DEFAULT 0, -- 🔥 عدد المرافقين
    companions_attended INTEGER DEFAULT 0, -- 🔥 عدد المرافقين الذين حضروا
    max_scans INTEGER DEFAULT 1, -- 🔥 الحد الأقصى للمسح (1 + المرافقين)
    scan_count INTEGER DEFAULT 0, -- 🔥 عدد المرات التي تم المسح فيها
    custom_data JSONB, -- بيانات إضافية من Excel
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Scans Table (سجل المسح)
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    scanned_at TIMESTAMP DEFAULT NOW(),
    source TEXT DEFAULT 'inspector_app', -- 'inspector_app', 'web', 'mobile'
    scan_result TEXT DEFAULT 'success', -- 🔥 'success', 'duplicate', 'invalid', 'exceeded_limit'
    scanned_companions INTEGER DEFAULT 0, -- 🔥 عدد المرافقين في هذا المسح
    inspector_name TEXT, -- اسم المشرف الذي مسح
    notes TEXT -- ملاحظات
);

-- Enable Row Level Security
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- Policies
create policy "Allow public event read" 
on events 
for select 
to public 
using (true);

create policy "Allow public guest read" 
on guests 
for select 
to public 
using (true);
