import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function setCard() {
    const guestId = '6e90b323-6bc5-4f80-9117-2ab727f20772';
    const testCardUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/qr-sample.png';
    
    console.log(`Setting test card URL for guest ${guestId}...`);
    
    const { error } = await supabase.from('guests')
        .update({ card_image_url: testCardUrl })
        .eq('id', guestId);
    
    if (error) console.error('Error:', error);
    else console.log('✅ Card image URL set successfully.');
}

setCard();
