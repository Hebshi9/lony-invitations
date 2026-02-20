import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function publishTestCards(eventId, phones) {
    console.log(`🚀 Publishing cards for test guests in Event: ${eventId}\n`);

    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, phone')
        .eq('event_id', eventId)
        .in('phone', phones);

    if (error) {
        console.error('❌ Error fetching guests:', error.message);
        return;
    }

    for (const [index, guest] of guests.entries()) {
        const serial = (index + 72).toString().padStart(3, '0'); // User gave (72) in image, let's use it
        const cardUrl = `https://via.placeholder.com/800x1200.png?text=Invitation+for+${encodeURIComponent(guest.name)}+Serial+${serial}`;

        const { error: updateError } = await supabase
            .from('guests')
            .update({
                status: 'ready_to_send',
                card_image_url: cardUrl,
                card_number: serial,
                card_generated: true,
                card_generated_at: new Date().toISOString()
            })
            .eq('id', guest.id);

        if (updateError) {
            console.error(`  ❌ Failed to update ${guest.name}:`, updateError.message);
        } else {
            console.log(`  ✅ Prepared card for ${guest.name} (Serial: ${serial})`);
        }
    }
}

const targetEventId = 'fbb9013e-1b3b-4b7e-901c-e3bee46ee0b7';
const targetPhones = ['+966503678789', '+966507240097'];
publishTestCards(targetEventId, targetPhones);
