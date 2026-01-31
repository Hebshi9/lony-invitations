-- Add card_image_url column to guests table
-- This will store the URL of the generated invitation card image

ALTER TABLE guests 
ADD COLUMN IF NOT EXISTS card_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN guests.card_image_url IS 'URL of the generated invitation card image stored in Supabase Storage';

-- Create storage bucket for invitation cards (if not exists)
-- Run this in Supabase Dashboard > Storage
-- Bucket name: invitation-cards
-- Public: true (so cards can be accessed via WhatsApp)
