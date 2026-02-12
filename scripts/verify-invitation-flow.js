
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function verifyFlow() {
    console.log('🚀 Starting Verification of Invitation Workflow...');

    // 1. Create a Test Guest
    const testPhone = '+966TEST' + Math.floor(Math.random() * 10000);
    const { data: event } = await supabase.from('events').select('id').limit(1).single();

    if (!event) {
        console.error('❌ No events found in database. Cannot test.');
        return;
    }

    const { data: guest, error: guestError } = await supabase.from('guests').insert({
        name: 'Test Guest AI',
        phone: testPhone,
        event_id: event.id,
        card_image_url: 'https://via.placeholder.com/500x800.png?text=Invitation+Barcode'
    }).select().single();

    if (guestError) {
        console.error('❌ Failed to create test guest:', guestError);
        return;
    }

    console.log(`✅ Created test guest: ${guest.name} (${guest.phone})`);

    // 2. Simulate Webhook Call for RSVP Confirmation via BUTTON
    console.log('📡 Simulating Webhook Button Click: rsvp_accept...');

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
                    selectedButtonId: 'rsvp_accept',
                    selectedDisplayText: '✅ تأكيد الحضور'
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
            console.error('❌ Webhook rejected the request. Is the server running on port 3001?');
            return;
        }
    } catch (e) {
        console.error('❌ Failed to connect to local server:', e.message);
        console.log('💡 Note: You need to run "node api/whatsapp-server-simple.js" first.');
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

    if (updatedGuest?.rsvp_status === 'confirmed') {
        console.log('✅ Guest RSVP status updated to "confirmed"!');
    } else {
        console.error(`❌ Guest RSVP status NOT updated properly. Current: ${updatedGuest?.rsvp_status}`);
    }

    const { data: reply } = await supabase
        .from('whatsapp_replies')
        .select('*')
        .eq('guest_id', guest.id)
        .maybeSingle();

    const { data: rsvpReply } = await supabase
        .from('whatsapp_rsvp')
        .select('*')
        .eq('guest_id', guest.id)
        .maybeSingle();

    if (reply || rsvpReply) {
        console.log('✅ RSVP reply recorded!');
        if (reply) console.log(`   Table: whatsapp_replies, Reply text: ${reply.reply_text}`);
        if (rsvpReply) console.log(`   Table: whatsapp_rsvp, Reply text: ${rsvpReply.response_message}`);
    } else {
        console.error('❌ No RSVP reply found in database (checked both tables).');
    }

    // 4. Cleanup
    await supabase.from('guests').delete().eq('id', guest.id);
    console.log('🧹 Cleanup complete.');
    console.log('🏁 Verification Finished.');
}

verifyFlow();
