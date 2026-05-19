import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function findCardInEvent() {
    const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1';
    console.log(`Searching for any guest with a card in event ${eventId}...`);
    const { data, error } = await supabase.from('guests')
        .select('id, name, card_image_url')
        .eq('event_id', eventId)
        .not('card_image_url', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('\n✅ Found guests with cards in this event:');
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log('No guests found with card_image_url in this specific event.');
        console.log('Checking all guests in this event to see if ANY have any data...');
        const { count } = await supabase.from('guests').select('*', { count: 'exact', head: true }).eq('event_id', eventId);
        console.log(`Total guests in this event: ${count}`);
    }
}

findCardInEvent();
