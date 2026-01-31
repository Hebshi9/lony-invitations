import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// We need an event ID. Let's get the first one from DB.
const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function triggerSend() {
    console.log('Fetching event...');
    const { data: event } = await supabase.from('events').select('id').limit(1).single();

    if (!event) {
        console.error('No event found!');
        return;
    }

    console.log(`Triggering send for event ${event.id}...`);

    try {
        const response = await fetch('http://127.0.0.1:3001/api/whatsapp/send-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId: event.id })
        });

        const json = await response.json();
        console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.error('Error triggering send:', e);
    }
}

triggerSend();
