-- Add timing and country fields to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS activation_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '13:00:00',
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Saudi Arabia';

-- Comment on columns
COMMENT ON COLUMN public.events.activation_time IS 'When the QR codes become active for scanning';
COMMENT ON COLUMN public.events.opening_time IS 'When the doors officially open (for display)';
COMMENT ON COLUMN public.events.country IS 'Country for timezone handling';
