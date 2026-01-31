-- PHASE 2: Database Expansion for Lony Invitation System

-- 0. Clients (New Table - Required for Orders)
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT
);

-- 1. Client Intake Requests (New Table)
-- Stores raw requests from the public intake form before they become official orders
CREATE TABLE IF NOT EXISTS client_intake_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    client_name TEXT,
    client_phone TEXT,
    client_email TEXT,
    event_details JSONB, -- { title, date, location, type }
    guest_list_url TEXT, -- URL to uploaded file
    status TEXT DEFAULT 'new', -- new, processing, processed, converted
    ai_analysis JSONB -- Result of AI processing
);

-- 2. Orders (New Table)
-- Tracks the lifecycle of an invitation order
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    client_id UUID REFERENCES clients(id), -- Optional link to registered client
    event_id UUID REFERENCES events(id),
    status TEXT DEFAULT 'drafting', -- drafting, waiting_approval, approved, completed
    workflow_stage TEXT DEFAULT 'intake', -- intake, cleaning, design, review, generation, delivery
    total_price DECIMAL(10, 2),
    notes TEXT
);

-- 3. Card Templates (New Table)
-- Stores the design configuration for the Canvas Editor
CREATE TABLE IF NOT EXISTS card_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id UUID REFERENCES events(id),
    name TEXT,
    canvas_data JSONB, -- The JSON config for the canvas layers
    background_url TEXT,
    dimensions JSONB, -- { width, height }
    is_active BOOLEAN DEFAULT true
);

-- 4. Update Guests Table (Add New Columns)
ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS companions_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb, -- Store extra Excel columns here
ADD COLUMN IF NOT EXISTS qr_token TEXT DEFAULT gen_random_uuid()::text, -- Secure token for QR
ADD COLUMN IF NOT EXISTS card_url TEXT; -- Link to generated card image

-- 5. Update Scans Table (Add New Columns)
ALTER TABLE scans
ADD COLUMN IF NOT EXISTS companions_scanned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scanner_device_info TEXT;

-- 6. Enable RLS (Security)
ALTER TABLE client_intake_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies (Permissive for now, can be tightened later)

-- Allow public to insert intake requests (for the public form)
DROP POLICY IF EXISTS "Allow public insert intake" ON client_intake_requests;
CREATE POLICY "Allow public insert intake" ON client_intake_requests FOR INSERT TO public WITH CHECK (true);
-- Allow admins (authenticated) to read all intake requests
DROP POLICY IF EXISTS "Allow admin read intake" ON client_intake_requests;
CREATE POLICY "Allow admin read intake" ON client_intake_requests FOR SELECT TO authenticated USING (true);

-- Orders: Allow authenticated users to manage orders, and public to READ (for Portal)
DROP POLICY IF EXISTS "Allow auth all orders" ON orders;
CREATE POLICY "Allow auth all orders" ON orders FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow public read orders" ON orders;
CREATE POLICY "Allow public read orders" ON orders FOR SELECT TO public USING (true);

-- Card Templates: Allow authenticated users to manage templates
DROP POLICY IF EXISTS "Allow auth all templates" ON card_templates;
CREATE POLICY "Allow auth all templates" ON card_templates FOR ALL TO authenticated USING (true);

-- Guests: Update policy to allow public read (for QR scanning) but restricted update
DROP POLICY IF EXISTS "Allow public read guests" ON guests;
CREATE POLICY "Allow public read guests" ON guests FOR SELECT TO public USING (true);
-- Allow public update ONLY for status/scan_count (via RPC or specific logic ideally, but for now direct update for Inspector)
DROP POLICY IF EXISTS "Allow public update guests" ON guests;
CREATE POLICY "Allow public update guests" ON guests FOR UPDATE TO public USING (true); 

-- Clients: Allow authenticated users to manage clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow auth all clients" ON clients;
CREATE POLICY "Allow auth all clients" ON clients FOR ALL TO authenticated USING (true);

-- 8. Create Storage Buckets
-- Bucket for raw files uploaded by clients
INSERT INTO storage.buckets (id, name, public) 
VALUES ('intake_files', 'intake_files', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket for final generated invitation cards
INSERT INTO storage.buckets (id, name, public) 
VALUES ('generated_cards', 'generated_cards', true)
ON CONFLICT (id) DO NOTHING;

-- Bucket for card templates
INSERT INTO storage.buckets (id, name, public) 
VALUES ('templates', 'templates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public Access Intake Files" ON storage.objects;
CREATE POLICY "Public Access Intake Files" ON storage.objects FOR SELECT TO public USING (bucket_id = 'intake_files');

DROP POLICY IF EXISTS "Public Upload Intake Files" ON storage.objects;
CREATE POLICY "Public Upload Intake Files" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'intake_files');

DROP POLICY IF EXISTS "Public Access Generated Cards" ON storage.objects;
CREATE POLICY "Public Access Generated Cards" ON storage.objects FOR SELECT TO public USING (bucket_id = 'generated_cards');

DROP POLICY IF EXISTS "Auth Upload Generated Cards" ON storage.objects;
CREATE POLICY "Auth Upload Generated Cards" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'generated_cards');

DROP POLICY IF EXISTS "Public Access Templates" ON storage.objects;
CREATE POLICY "Public Access Templates" ON storage.objects FOR SELECT TO public USING (bucket_id = 'templates');

DROP POLICY IF EXISTS "Auth Upload Templates" ON storage.objects;
CREATE POLICY "Auth Upload Templates" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'templates');
