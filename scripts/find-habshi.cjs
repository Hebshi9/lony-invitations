const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('--- Searching for Event: الحبشي ---');
    const { data: events, error: eError } = await supabase
        .from('events')
        .select('*')
        .ilike('name', '%الحبشي%');

    if (eError) {
        console.error('Error fetching event:', eError.message);
        return;
    }

    if (events.length === 0) {
        console.log('No event found with that name.');
        return;
    }

    const event = events[0];
    console.log(`Event Found: ${event.name} (ID: ${event.id})`);
    console.log(`Groom: ${event.groom_name}, Bride: ${event.bride_name}`);
    console.log(`Card URL: ${event.card_image_url || 'None'}`);

    // Look for guests in this event
    const { data: guests, error: gError } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', event.id)
        .limit(5);

    if (gError) {
        console.error('Error fetching guests:', gError.message);
    } else {
        console.log(`Guests in this event: ${guests.length}`);
        guests.forEach(g => console.log(`- ${g.name} (${g.phone})`));
    }
}

run();
