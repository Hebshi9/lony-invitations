-- Migration: Finalize Business Ledger Schema
-- Adding mission-critical financial and strategic fields

ALTER TABLE public.business_ledger 
ADD COLUMN IF NOT EXISTS dispatch_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS supervisor_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS designer_fee NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'غير محدد',
ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;

-- Add check constraints for lead_source if needed (optional but good for consistency)
-- ALTER TABLE public.business_ledger ADD CONSTRAINT check_lead_source 
-- CHECK (lead_source IN ('انستقرام', 'تيك توك', 'سناب شات', 'توصية', 'أخرى', 'غير محدد'));

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
