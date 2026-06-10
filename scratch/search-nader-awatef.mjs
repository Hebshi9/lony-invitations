import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("🔍 Searching for events related to 'نادر' or 'عواطف'...");
    const { data: events, error: evError } = await supabase
        .from('events')
        .select('id, name, created_at, settings')
        .or('name.ilike.%نادر%,name.ilike.%عواطف%');

    if (evError) {
        console.error('Error finding events:', evError);
        return;
    }

    console.log(`📊 Found ${events.length} matching events:`);
    events.forEach(e => {
        console.log(`- ID: ${e.id} | Name: ${e.name} | Settings: ${JSON.stringify(e.settings || {})}`);
    });

    if (events.length === 0) {
        // Let's search all events to see if we missed it
        const { data: allEvents } = await supabase.from('events').select('id, name').limit(10);
        console.log("Here are some recent events instead:", allEvents);
        return;
    }

    const eventId = events[0].id;
    console.log(`\n🔍 Searching for guest 'هدى' in event: ${events[0].name} (${eventId})...`);
    const { data: guests, error: gError } = await supabase
        .from('guests')
        .select('id, name, phone, status')
        .eq('event_id', eventId)
        .ilike('name', '%هدى%');

    if (gError) {
        console.error('Error finding guests:', gError);
        return;
    }

    console.log(`👥 Found ${guests.length} guests:`);
    guests.forEach(g => {
        console.log(`- Guest ID: ${g.id} | Name: ${g.name} | Phone: ${g.phone} | Status: ${g.status}`);
    });
}

run();
