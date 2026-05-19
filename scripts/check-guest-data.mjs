import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkGuest() {
    const phone = '966503678789';
    const { data: guests, error } = await supabase.from('guests').select('*').eq('phone', phone);
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    console.log(`\n--- GUEST DATA (${phone}) ---`);
    guests.forEach(g => {
        console.log(`ID: ${g.id} | Name: ${g.name} | RSVP: ${g.rsvp_status}`);
        console.log(`Card Image URL: ${g.card_image_url || 'MISSING'}`);
        console.log(`-----------------------------------`);
    });
}

checkGuest();
