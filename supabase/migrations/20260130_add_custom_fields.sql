-- Add custom_fields column to guests table to store dynamic Excel data
ALTER TABLE guests ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
COMMENT ON COLUMN guests.custom_fields IS 'Flexible JSON storage for additional guest data from Excel';
