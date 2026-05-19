/*
 * Scratch Script to find Al-Jiffri Event and Guests (ESM)
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findEventAndGuests() {
    console.log('🔍 Searching for Jiffri event...');
    const { data: events, error: e1 } = await supabase
        .from('events')
        .select('id, name')
        .ilike('name', '%الجفري%');

    if (e1 || !events.length) {
        console.error('❌ Event not found (Check Name):', e1);
        return;
    }

    const event = events[0];
    console.log(`✅ Found Event: ${event.name} (ID: ${event.id})`);

    const { data: guests, error: e2 } = await supabase
        .from('guests')
        .select('id, name, phone')
        .eq('event_id', event.id)
        .limit(2);

    if (e2 || !guests.length) {
        console.error('❌ Guests not found in this event.');
        return;
    }

    console.log(`👥 Sample Guests found: ${guests.length}`);
    guests.forEach(g => console.log(` - ${g.name} (${g.phone})`));

    console.log('\n🚀 Triggering Campaign via Local Server 3002...');
    const payload = {
        eventId: event.id,
        guestIds: guests.map(g => g.id),
        campaignType: 'invitation'
    };

    try {
        const res = await fetch('http://localhost:3002/api/send-campaign-background', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        console.log('✅ Server Response:', JSON.stringify(result));
    } catch (err) {
        console.error('❌ Server Connection Failed. Make sure node api/whatsapp-server-v2.js is running!');
    }
}

findEventAndGuests();
