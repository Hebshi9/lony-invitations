
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyDeclinedFlow() {
    console.log('🚀 Starting Verification of DECLINED RSVP Workflow...');

    // 1. Create a Test Guest
    const testPhone = '+966TEST_DEC' + Math.floor(Math.random() * 10000);
    const { data: event } = await supabase.from('events').select('id').limit(1).single();

    if (!event) {
        console.error('❌ No events found in database. Cannot test.');
        return;
    }

    const { data: guest, error: guestError } = await supabase.from('guests').insert({
        name: 'Test Guest Decline',
        phone: testPhone,
        event_id: event.id
    }).select().single();

    if (guestError) {
        console.error('❌ Failed to create test guest:', guestError);
        return;
    }

    console.log(`✅ Created test guest: ${guest.name} (${guest.phone})`);

    // 2. Simulate Webhook Call for RSVP Decline via BUTTON
    console.log('📡 Simulating Webhook Button Click: rsvp_decline...');

    const webhookPayload = {
        event: 'messages.upsert',
        instance: 'LONY_MAIN_V4',
        data: {
            key: {
                remoteJid: `${testPhone.replace('+', '')}@s.whatsapp.net`,
                fromMe: false,
                id: 'MOCK_ID_' + Date.now()
            },
            message: {
                buttonsResponseMessage: {
                    selectedButtonId: 'rsvp_decline',
                    selectedDisplayText: '❌ اعتذار'
                }
            },
            messageTimestamp: Math.floor(Date.now() / 1000)
        }
    };

    try {
        const res = await fetch('http://localhost:3001/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
        });

        if (res.ok) {
            console.log('✅ Webhook accepted the mock request.');
        } else {
            console.error('❌ Webhook rejected the request. Status:', res.status);
            return;
        }
    } catch (e) {
        console.error('❌ Failed to connect to local server:', e.message);
        return;
    }

    // 3. Verify Database Updates
    console.log('🔍 Verifying database updates...');
    await new Promise(r => setTimeout(r, 2000)); // Wait for processing

    const { data: updatedGuest } = await supabase
        .from('guests')
        .select('rsvp_status')
        .eq('id', guest.id)
        .single();

    if (updatedGuest?.rsvp_status === 'declined') {
        console.log('✅ Guest RSVP status updated to "declined"!');
    } else {
        console.error(`❌ Guest RSVP status NOT updated properly. Current: ${updatedGuest?.rsvp_status}`);
    }

    // 4. Cleanup
    await supabase.from('guests').delete().eq('id', guest.id);
    console.log('🧹 Cleanup complete.');
    console.log('🏁 Verification Finished.');
}

verifyDeclinedFlow();
