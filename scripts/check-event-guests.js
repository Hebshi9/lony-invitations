import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkEventGuests() {
    const eventId = 'fbb9013e-1b3b-4b7e-901c-e3bee46ee0b7'; // من الصورة

    console.log('📋 Checking guests for event:', eventId, '\n');

    const { data: guests, error } = await supabase
        .from('guests')
        .select('name, phone, card_image_url')
        .eq('event_id', eventId)
        .order('name');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Total guests: ${guests.length}\n`);

    guests.forEach((g, i) => {
        console.log(`${i + 1}. ${g.name}`);
        console.log(`   Phone: ${g.phone || 'NO PHONE'}`);
        console.log(`   Has Image: ${g.card_image_url ? 'YES' : 'NO'}`);
        console.log('');
    });
}

checkEventGuests();
