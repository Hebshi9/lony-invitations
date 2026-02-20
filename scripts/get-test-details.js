import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function getFullDetails(eventId, phones) {
    console.log(`🔍 Fetching details for Event: ${eventId}\n`);

    const { data: event, error: eError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (eError) {
        console.error('❌ Error fetching event:', eError.message);
        return;
    }

    console.log(`✅ Event: ${event.name}`);
    console.log(`- Date: ${event.date}`);
    console.log(`- Activation: ${event.qr_active_from || 'None'} (Enabled: ${event.qr_activation_enabled})`);

    const { data: guests, error: gError } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', eventId)
        .in('phone', phones);

    if (gError) {
        console.error('❌ Error fetching guests:', gError.message);
        return;
    }

    console.log('\n👥 Target Guests:');
    for (const guest of guests) {
        console.log(`- ${guest.name} (${guest.phone})`);
        console.log(`  - RSVP: ${guest.rsvp_status || 'Pending'}`);
        console.log(`  - Card Image: ${guest.card_image_url || 'None'}`);
        console.log(`  - QR Token: ${guest.qr_token || 'None'}`);
    }
}

const targetEventId = 'fbb9013e-1b3b-4b7e-901c-e3bee46ee0b7';
const targetPhones = ['0503678789', '0507240097', '+966503678789', '+966507240097'];
getFullDetails(targetEventId, targetPhones);
