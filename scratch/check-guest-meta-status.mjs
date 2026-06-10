import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkGuest() {
    console.log('🔍 Checking guest status and recent messages for 966503678789...');
    
    const { data: guests, error: guestError } = await supabase.from('guests')
        .select('*')
        .eq('phone', '966503678789');

    if (guestError) {
        console.error('Guest fetch error:', guestError);
        return;
    }

    console.log(`Found ${guests?.length || 0} guests with phone 966503678789`);
    for (const g of guests || []) {
        console.log(`Guest ID: ${g.id} | Name: ${g.name} | Status: ${g.status} | RSVP: ${g.rsvp_status} | Event: ${g.event_id}`);
        
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

checkGuest();
