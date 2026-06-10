import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const PHONE = '966505424030';

async function tracePhone() {
    console.log(`Tracing guest records for phone: ${PHONE}...`);
    const { data: guests, error } = await supabase
        .from('guests')
        .select('*, events(name)')
        .eq('phone', PHONE);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${guests.length} guest records:`);
    for (const g of guests) {
        console.log(`- Guest ID: ${g.id}`);
        console.log(`  Name: ${g.name}`);
        console.log(`  Event: ${g.events?.name} (${g.event_id})`);
        console.log(`  Status: ${g.status}`);
        console.log(`  RSVP Status: ${g.rsvp_status}`);
        console.log(`  Updated At: ${g.updated_at}`);
        
        const { data: msgs } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('guest_id', g.id);

        console.log(`  Messages count: ${msgs?.length || 0}`);
        msgs?.forEach((m, idx) => {
            console.log(`    [Msg ${idx+1}] ID: ${m.id} | Phase: ${m.message_phase} | Status: ${m.status} | Delivery: ${m.delivery_status} | Error: ${m.error_message} | WAMID: ${m.evolution_message_id}`);
        });
        console.log("-----------------------------------------");
    }
}

tracePhone();
