import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'fc3ef9f5-4626-4a9f-aa1d-21058bf37841';

async function checkCardMapping() {
    console.log('🔍 Querying guests list for Aseel & Abdulrahman wedding...');
    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, phone, card_number, card_image_url, rsvp_status')
        .eq('event_id', EVENT_ID)
        .order('card_number', { ascending: true });

    if (error) {
        console.error('Error fetching guests:', error);
        return;
    }

    console.log(`Total guests in event: ${guests.length}`);
    console.log('\nList of guests with card numbers:');
    guests.forEach(g => {
        if (g.card_number || g.card_image_url) {
            console.log(`Card #${g.card_number} | ID: ${g.id} | Name: ${g.name} | Phone: ${g.phone} | Card URL: ${g.card_image_url ? 'YES' : 'NO'} | RSVP: ${g.rsvp_status}`);
        } else {
            console.log(`No card info | ID: ${g.id} | Name: ${g.name} | Phone: ${g.phone} | RSVP: ${g.rsvp_status}`);
        }
    });
}

checkCardMapping();
