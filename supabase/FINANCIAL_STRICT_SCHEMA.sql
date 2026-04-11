-- ==========================================
-- 💰 FINANCIAL & ORDERS MODULE SCHEMA
-- ==========================================

-- 1. Orders Table: إدارة الطلبات وحالاتها
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name TEXT NOT NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    order_type TEXT DEFAULT 'invitation', -- 'invitation', 'physical_card', 'full_package'
    total_amount DECIMAL(10, 2) DEFAULT 0.00,
    deposit_amount DECIMAL(10, 2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'refunded'
    payment_method TEXT, -- 'rajhi', 'ahli', 'stcpay', 'alinma', 'cash'
    order_status TEXT DEFAULT 'new', -- 'new', 'processing', 'completed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Marketing Costs Table: تكاليف التسويق والمنصات
CREATE TABLE IF NOT EXISTS public.marketing_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform TEXT NOT NULL, -- 'tiktok', 'snapchat', 'instagram', 'twitter'
    campaign_name TEXT,
    cost DECIMAL(10, 2) NOT NULL,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    leads_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI Financial Insights: نصائح الذكاء الاصطناعي المخزنة (اختياري)
CREATE TABLE IF NOT EXISTS public.financial_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_year TEXT NOT NULL, -- '2026-04'
    total_revenue DECIMAL(10, 2),
    total_marketing_cost DECIMAL(10, 2),
    margin_percentage DECIMAL(5, 2),
    ai_recommendations TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_insights ENABLE ROW LEVEL SECURITY;

-- Simple Access Policies (Admin Only)
CREATE POLICY "Allow all access for authenticated admins" ON public.orders
    USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated admins" ON public.marketing_costs
    USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all access for authenticated admins" ON public.financial_insights
    USING (auth.role() = 'authenticated');
