-- Add new columns for Event Packages and Simple Scan
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'premium', -- 'standard' | 'premium'
ADD COLUMN IF NOT EXISTS host_pin text, -- 4 digit PIN
ADD COLUMN IF NOT EXISTS enable_simple_scan boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN events.package_type IS 'Type of package: standard (simple scan) or premium (app)';
COMMENT ON COLUMN events.host_pin IS 'PIN for host mode login on guest pages';
