import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function findGuestsByPhone(phones) {
    console.log(`🔍 Searching for guests with phones: ${phones.join(', ')}\n`);

    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, phone, event_id, rsvp_status, card_image_url')
        .in('phone', phones);

    if (error) {
        console.error('❌ Error searching guests:', error.message);
        return;
    }

    if (!guests || guests.length === 0) {
        console.log('ℹ️ No guests found with these numbers.');
    } else {
        console.log('✅ Found Guests:');
        for (const guest of guests) {
            console.log(`- ${guest.name} (${guest.phone}) | Event ID: ${guest.event_id} | RSVP: ${guest.rsvp_status || 'Pending'}`);
        }
    }
}

const targetPhones = ['0503678789', '0507240097', '+966503678789', '+966507240097'];
findGuestsByPhone(targetPhones);
