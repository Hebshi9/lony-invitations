import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCards() {
    console.log("🔍 Searching for events matching 'ارين' or 'عمار'...");
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id, name, date')
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
        console.log(`📊 Checking Guest Cards for: "${event.name}" (ID: ${event.id})`);
        const { data: guests, error: guestError } = await supabase
            .from('guests')
            .select('id, name, phone, card_image_url, rsvp_status, status')
            .eq('event_id', event.id);

        if (guestError) {
            console.error("❌ Error fetching guests:", guestError);
            continue;
        }

        const totalGuests = guests.length;
        const withCards = guests.filter(g => g.card_image_url);
        const withoutCards = guests.filter(g => !g.card_image_url);

        console.log(`- Total Guests: ${totalGuests}`);
        console.log(`- Guests WITH Cards: ${withCards.length}`);
        console.log(`- Guests WITHOUT Cards: ${withoutCards.length}`);

        if (withoutCards.length > 0) {
            console.log(`\n⚠️ List of Guests WITHOUT Cards (${withoutCards.length}):`);
            withoutCards.forEach((g, idx) => {
                console.log(`${idx + 1}. Name: "${g.name}" | Phone: ${g.phone} | RSVP Status: ${g.rsvp_status} | Sending Status: ${g.status}`);
            });
        } else {
            console.log(`\n🎉 All guests in this event have their cards uploaded!`);
        }
    }
}

checkCards();
