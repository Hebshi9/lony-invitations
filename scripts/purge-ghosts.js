
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function purgeGhosts() {
    const eventId = '7b29628f-8a84-4523-a896-9026ddefac11'; // Chocolate Event
    console.log(`🧹 Starting Ghost Purge for event: ${eventId}`);

    // 1. Fetch all guests marked as 'sent'
    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, phone, status')
        .eq('event_id', eventId)
        .eq('status', 'sent');

    if (error) {
        console.error('Error fetching guests:', error.message);
        return;
    }

    console.log(`🔍 Found ${guests.length} guests with 'sent' status. Checking for messages...`);

    let purgeCount = 0;
    for (const guest of guests) {
        // Check if a message record exists
        const { data: messages } = await supabase
            .from('whatsapp_messages')
            .select('id')
            .eq('guest_id', guest.id)
            .limit(1);

        if (!messages || messages.length === 0) {
            console.log(`👻 GHOST DETECTED: ${guest.name} (${guest.phone}) - No message record. Resetting...`);
            
            // Reset to NULL/Idle
            const { error: updateError } = await supabase
                .from('guests')
                .update({ status: null })
                .eq('id', guest.id);
            
            if (updateError) {
                console.error(`❌ Failed to update ${guest.name}:`, updateError.message);
            } else {
                purgeCount++;
            }
        }
    }

    console.log(`\n✅ PURGE COMPLETE!`);
    console.log(`✨ Reset ${purgeCount} ghost guests to 'idle' status.`);
}

purgeGhosts();
