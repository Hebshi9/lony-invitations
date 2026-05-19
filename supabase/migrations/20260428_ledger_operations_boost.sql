-- Add operational boost columns to business_ledger
ALTER TABLE public.business_ledger ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'عادية';
ALTER TABLE public.business_ledger ADD COLUMN IF NOT EXISTS assignee TEXT DEFAULT '';
ALTER TABLE public.business_ledger ADD COLUMN IF NOT EXISTS guest_count INTEGER;

-- Ensure these columns are accessible
GRANT ALL ON TABLE public.business_ledger TO anon;
GRANT ALL ON TABLE public.business_ledger TO authenticated;
GRANT ALL ON TABLE public.business_ledger TO service_role;
