import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkCards() {
    console.log("🔍 Searching for events matching 'ارين' or 'عمار'...");
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id, name')
        .or('name.ilike.%ارين%,name.ilike.%عمار%');

    if (eventError) {
        console.error("❌ Error fetching events:", eventError);
        return;
    }

    if (!events || events.length === 0) {
        console.log("❌ No events matching 'ارين' or 'عمار' found.");
        return;
    }

    for (const event of events) {
        console.log(`📊 Event found: "${event.name}" (ID: ${event.id})`);
        const { data: guests, error: guestError } = await supabase
            .from('guests')
            .select('id, name, phone, card_image_url, rsvp_status, status')
            .eq('event_id', event.id);

        if (guestError) {
            console.error("❌ Error fetching guests:", guestError);
            continue;
        }

        const totalGuests = guests.length;
        const withCards = guests.filter(g => g.card_image_url && g.card_image_url.trim() !== '');
        const withoutCards = guests.filter(g => !g.card_image_url || g.card_image_url.trim() === '');

        console.log(`- Total guests registered: ${totalGuests}`);
        console.log(`- Guests with cards: ${withCards.length}`);
        console.log(`- Guests without cards: ${withoutCards.length}`);

        if (withoutCards.length > 0) {
            console.log(`\n⚠️ The following ${withoutCards.length} guests DO NOT have cards uploaded:`);
            withoutCards.forEach((g, idx) => {
                console.log(`  [${idx + 1}] Name: "${g.name}" | Phone: ${g.phone} | RSVP: ${g.rsvp_status} | Sending: ${g.status}`);
            });
        } else {
            console.log(`\n🎉 Success: Every single guest in this event has a card image uploaded!`);
        }
    }
}

checkCards();
