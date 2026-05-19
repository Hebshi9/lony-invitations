-- Migration: Add financial_settings table
-- Fixes the issue where financial targets revert to 50,000

CREATE TABLE IF NOT EXISTS financial_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    monthly_target NUMERIC(15, 2) DEFAULT 10000,
    monthly_marketing_budget NUMERIC(15, 2) DEFAULT 2000,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_row_only CHECK (id = 1)
);

-- Seed initial data if not exists
INSERT INTO financial_settings (id, monthly_target, monthly_marketing_budget)
VALUES (1, 10000, 2000)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for everyone" ON financial_settings FOR ALL USING (true);
