import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// Search for the last digit patterns
const partialPhone = '3678789'; 

async function searchGuest() {
    console.log(`🔍 Searching for Guests ending in: ${partialPhone}\n`);

    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, phone, card_image_url, rsvp_status')
        .like('phone', `%${partialPhone}`);
    
    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (guests && guests.length > 0) {
        console.log(`✅ Found ${guests.length} match(es):`);
        guests.forEach(g => {
            console.log(`- ID: ${g.id} | Name: ${g.name} | Phone: ${g.phone} | Status: ${g.rsvp_status} | Card: ${g.card_image_url ? 'YES' : 'NO'}`);
        });
    } else {
        console.log('❌ No guests found matching that pattern.');
    }
}

searchGuest();
