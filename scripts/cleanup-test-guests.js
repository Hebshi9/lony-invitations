import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function cleanupAndReset(eventId, phones) {
    console.log(`🧹 Cleaning up guests for Event: ${eventId}\n`);

    // 1. Delete all existing ones to start fresh
    const { error: dError } = await supabase
        .from('guests')
        .delete()
        .eq('event_id', eventId)
        .in('phone', phones);

    if (dError) {
        console.error('❌ Error deleting guests:', dError.message);
        return;
    }

    console.log('✅ Deleted existing test guests.');

    // 2. Create two fresh ones
    const newGuests = [
        {
            name: 'احمد الحبشي',
            phone: '+966503678789',
            event_id: eventId,
            rsvp_status: 'pending',
            qr_token: 'test-ahmed-' + Date.now(),
            status: 'pending'
        },
        {
            name: 'ساره الجفري',
            phone: '+966507240097',
            event_id: eventId,
            rsvp_status: 'pending',
            qr_token: 'test-sarah-' + Date.now(),
            status: 'pending'
        }
    ];

    const { data: created, error: iError } = await supabase
        .from('guests')
        .insert(newGuests)
        .select();

    if (iError) {
        console.error('❌ Error creating guests:', iError.message);
        return;
    }

    console.log(`✅ Created ${created.length} fresh test guests.`);
    for (const g of created) {
        console.log(`- ${g.name} (${g.phone}) | QR: ${g.qr_token}`);
    }
}

const targetEventId = 'fbb9013e-1b3b-4b7e-901c-e3bee46ee0b7';
const targetPhones = ['0503678789', '0507240097', '+966503678789', '+966507240097'];
cleanupAndReset(targetEventId, targetPhones);
