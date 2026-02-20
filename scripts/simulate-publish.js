import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function simulatePublish(eventId) {
    console.log(`🚀 Simulating 'Publish to Database' for Event: ${eventId}\n`);

    // 1. Get guests
    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, qr_token')
        .eq('event_id', eventId)
        .limit(3); // Just test with 3 guests

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.log(`✅ Found ${guests.length} guests for simulation.`);

    for (const [index, guest] of guests.entries()) {
        const serial = (index + 1).toString().padStart(3, '0');
        console.log(`- Highlighting: ${guest.name} (Serial: ${serial})`);

        // Simulate card generation by setting a placeholder URL
        // In the real app, this is a real PNG upload.
        const dummyUrl = `https://via.placeholder.com/800x1200.png?text=Invitation+for+${encodeURIComponent(guest.name)}+No+${serial}`;

        const { error: updateError } = await supabase
            .from('guests')
            .update({
                status: 'ready_to_send',
                card_image_url: dummyUrl,
                card_number: serial,
                card_generated: true,
                card_generated_at: new Date().toISOString()
            })
            .eq('id', guest.id);

        if (updateError) {
            console.error(`  ❌ Failed to update ${guest.name}:`, updateError.message);
        } else {
            console.log(`  ✅ Updated ${guest.name} to 'ready_to_send'`);
        }
    }

    console.log('\n✨ Simulation Complete!');
}

// Use the first valid event from our previous check
const TEST_EVENT_ID = 'c132c248-0086-4abd-bc6b-7f6d7993445a';
simulatePublish(TEST_EVENT_ID);
