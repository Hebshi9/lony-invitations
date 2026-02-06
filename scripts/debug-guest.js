
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkGuest() {
    console.log('--- Debugging Guest Status ---');

    // Query by specific phone
    const { data: guests, error } = await supabase
        .from('guests')
        .select('*')
        .ilike('phone', '%966_03678789%') // Try simpler match or known number
        // Actally I recall the number was +966503678789
        // I'll search broadly
        .ilike('phone', '%503678789%');

    if (error) {
        console.error('Error fetching guests:', error);
        return;
    }

    if (guests && guests.length > 0) {
        console.log(`Found ${guests.length} guest(s).`);

        for (const guest of guests) {
            console.log(`\n=== Guest: ${guest.name} ===`);
            console.log(`ID: ${guest.id}`);
            console.log(`Phone: ${guest.phone}`);
            console.log(`Status: ${guest.rsvp_status}`);
            console.log(`Last Updated: ${guest.updated_at}`);
            console.log(`Card URL: ${guest.card_image_url ? 'YES' : 'NO'}`);

            // Check personalized messages
            const { data: messages } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .eq('guest_id', guest.id)
                .order('created_at', { ascending: false });

            console.log('Messages:');
            messages.forEach(m => {
                console.log(`- [${m.status}] Phase: ${m.message_phase} | Sent: ${m.sent_at}`);
            });
        }
    } else {
        console.log('No guests found with that phone number.');
    }
}

checkGuest();
