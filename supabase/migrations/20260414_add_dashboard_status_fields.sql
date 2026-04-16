-- Add columns for better dashboard tracking and real-time reflection
ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_message_status TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Index for phone suffix matching in handleRSVP (performance optimization)
-- We use REVERSE for efficient suffix matching if needed, 
-- but a simple B-Tree is usually enough for ILIKE '%suffix' if the table is small.
CREATE INDEX IF NOT EXISTS idx_guests_phone_suffix ON guests (right(phone, 9));
