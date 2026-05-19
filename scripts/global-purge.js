
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function globalPurge() {
    console.log(`🧹 Starting GLOBAL Ghost Purge across ALL events...`);

    // 1. Fetch ALL guests marked as 'sent'
    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, phone, status, event_id')
        .eq('status', 'sent');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    console.log(`🔍 Checking ${guests.length} guests for ghost status...`);

    let purgeCount = 0;
    for (const guest of guests) {
        const { data: messages } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('guest_id', guest.id)
            .limit(1);

        if (!messages || messages.length === 0) {
            console.log(`👻 GHOST: ${guest.name} (${guest.phone}) - No message. Resetting...`);
            await supabase.from('guests').update({ status: null }).eq('id', guest.id);
            purgeCount++;
        }
    }

    console.log(`\n✅ GLOBAL PURGE COMPLETE! Reset ${purgeCount} ghosts.`);
}

globalPurge();
