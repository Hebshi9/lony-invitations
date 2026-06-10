import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkFirstGuest() {
    const eventId = 'd3df674a-dab9-42bb-96bf-acc86b144b59';
    console.log(`🔍 Checking Guest 001 for event ${eventId}...`);
    
    const { data: guests, error } = await supabase.from('guests')
        .select('*')
        .eq('event_id', eventId)
        .eq('phone', '966503678789');
        
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(`Found ${guests?.length || 0} matching guests for phone 966503678789 in event.`);
    for (const g of guests || []) {
        console.log(`Guest ID: ${g.id} | Name: ${g.name} | Status: ${g.status} | RSVP: ${g.rsvp_status}`);
        
        const { data: msgs } = await supabase.from('whatsapp_messages')
            .select('*')
            .eq('guest_id', g.id)
            .order('created_at', { ascending: false });
            
        console.log(`  Messages: ${msgs?.length || 0}`);
        msgs?.forEach(m => {
            console.log(`    [${m.created_at}] Status: ${m.status} | Delivery: ${m.delivery_status} | Error: ${m.error_message || 'None'} | Text: ${m.message_text}`);
        });
    }
}

checkFirstGuest();
