-- Lony AI Executive Suite: Financial Ledger & Configuration
-- Migration: Sprint 6

-- 1. Business Configuration Table (Targets & Global Settings)
CREATE TABLE IF NOT EXISTS business_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial targets
INSERT INTO business_config (key, value)
VALUES 
    ('monthly_target', '{"amount": 50000, "currency": "SAR"}'),
    ('yearly_target', '{"amount": 500000, "currency": "SAR"}')
ON CONFLICT (key) DO NOTHING;

-- 2. Business Ledger (Orders, Payments, & Costs)
CREATE TABLE IF NOT EXISTS business_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Client Info
    client_name TEXT NOT NULL,
    client_phone TEXT,
    
    -- Service Info
    service_type TEXT CHECK (service_type IN ('بكج كامل', 'تصميم فقط', 'تصميم وباركود')),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    
    -- Financials
    total_price NUMERIC(10, 2) DEFAULT 0,
    deposit_amount NUMERIC(10, 2) DEFAULT 0,
    remaining_balance NUMERIC(10, 2) GENERATED ALWAYS AS (total_price - deposit_amount) STORED,
    designer_fee NUMERIC(10, 2) DEFAULT 0,
    marketing_cost NUMERIC(10, 2) DEFAULT 0,
    
    -- CRM / Pipeline
    status TEXT DEFAULT 'قيد التنفيذ' CHECK (status IN ('قيد التنفيذ', 'مكتمل', 'ملغي', 'مديونية')),
    payment_status TEXT DEFAULT 'عربون' CHECK (payment_status IN ('غير مدفوع', 'عربون', 'مدفوع بالكامل')),
    follow_up_date DATE,
    notes TEXT,
    
    -- Metadata
    ai_parsed BOOLEAN DEFAULT FALSE,
    raw_input TEXT
);

-- RLS (Row Level Security) - Assuming public for local dev, but usually would be authenticated
ALTER TABLE business_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for everyone" ON business_ledger FOR ALL USING (true);
CREATE POLICY "Enable all for everyone" ON business_config FOR ALL USING (true);
