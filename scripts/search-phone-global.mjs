import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const PHONE_TO_CHECK = '966503678789';

async function searchGlobal() {
    console.log(`Global search for phone: ${PHONE_TO_CHECK}...`);

    // Search guests
    const { data: guests, error: err1 } = await supabase
        .from('guests')
        .select('*, events(name)')
        .or(`phone.eq.${PHONE_TO_CHECK},phone.eq.0503678789,phone.eq.503678789`);

    if (err1) {
        console.error("Error searching guests:", err1);
        return;
    }

    console.log(`\nFound ${guests.length} guest records globally:`);
    for (const g of guests) {
        console.log(`- Guest ID: ${g.id}`);
        console.log(`  Name: ${g.name}`);
        console.log(`  Phone: ${g.phone}`);
        console.log(`  Event: ${g.events?.name} (${g.event_id})`);
        console.log(`  Status: ${g.status}`);
        console.log(`  RSVP Status: ${g.rsvp_status}`);
        
        // Fetch messages for this guest
        const { data: msgs } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('guest_id', g.id)
            .order('created_at', { ascending: false });
            
        console.log(`  Messages (${msgs?.length || 0}):`);
        msgs?.forEach((m, idx) => {
            console.log(`    [${idx+1}] Phase: ${m.message_phase} | Status: ${m.status} | Delivery: ${m.delivery_status} | Error: ${m.error_message}`);
        });
        console.log("----------------------------------------");
    }
}

searchGlobal();
