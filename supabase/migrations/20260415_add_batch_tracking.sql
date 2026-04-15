-- Migration: Add Batch Tracking to Guests
-- Description: Adds batch_number and batch_name to support separate invitation batches.

ALTER TABLE guests ADD COLUMN IF NOT EXISTS batch_number INTEGER DEFAULT 1;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS batch_name TEXT;

-- Index for performance when filtering by batch
CREATE INDEX IF NOT EXISTS idx_guests_batch ON guests(event_id, batch_number);

-- Comment for documentation
COMMENT ON COLUMN guests.batch_number IS 'Identifies which import or addition phase this guest belongs to';
