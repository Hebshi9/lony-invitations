import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Adding test guest...');

    // 1. Create Event (if not exists, or get existing)
    // We can't easily upsert events with anon key if RLS blocks it, but let's try.
    // Or just pick the first available event.

    let eventId = 'live-test-event-001';

    const { data: events } = await supabase.from('events').select('id').limit(1);
    if (events && events.length > 0) {
        eventId = events[0].id;
        console.log(`Using existing event: ${eventId}`);
    } else {
        // Try to create one
        const { data: newEvent, error } = await supabase.from('events').insert([{
            name: 'Live Test Event',
            date: new Date().toISOString(),
            location: 'Riyadh'
        }]).select().single();

        if (error) {
            console.error('Failed to create event:', error.message);
            // If we can't create event, we can't add guest.
            // Assumption: There is at least one event from previous setups.
            if (!newEvent) return;
        } else {
            eventId = newEvent.id;
        }
    }

    // 2. Add Guest
    // Phone: 966503678789
    const phone = '966503678789';

    const { data, error } = await supabase.from('guests').insert([{
        event_id: eventId,
        name: 'الضيف الكريم (Test User)',
        phone: phone,
        rsvp_status: 'pending'
    }]);

    if (error) {
        console.error('Error adding guest:', error.message);
    } else {
        console.log(`✅ Guest added successfully! Phone: ${phone}`);
    }
}

run();
