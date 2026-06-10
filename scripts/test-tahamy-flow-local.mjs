import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { handler as sendCampaignHandler } from '../netlify/functions/send-campaign.mjs';
import { handler as webhookHandler } from '../netlify/functions/meta-webhook.mjs';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTahamyFlow() {
    const phone = '966507240097'; // Sarah
    console.log(`🧹 Cleaning old test data for phone: ${phone}`);

    // 1. Find the guest in Al-Tahamy event
    // The Event ID for حفل زفاف الطحامي is e5c16571-e50c-4ff3-ab76-259813717c62
    const eventId = 'e5c16571-e50c-4ff3-ab76-259813717c62';

    let { data: guests, error: findErr } = await supabase
        .from('guests')
        .select('id, event_id, name')
        .eq('phone', phone)
        .eq('event_id', eventId)
        .limit(1);

    if (findErr || !guests || guests.length === 0) {
        console.log('❌ Could not find Sarah in Tahamy event. Inserting...');
        const { data: newGuest, error: insErr } = await supabase.from('guests').insert([{
            event_id: eventId,
            name: 'ساره',
            phone: phone,
            status: 'idle',
            card_image_url: `https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/${eventId}/mock.jpg`
        }]).select();
        
        if (insErr) {
            console.error('Failed to create guest', insErr);
            return;
        }
        guests = newGuest;
    }

    const guestId = guests[0].id;

    // 2. Clean messages and reset status
    await supabase.from('whatsapp_messages').delete().eq('guest_id', guestId);
    await supabase.from('guests').update({ status: 'idle', rsvp_status: null, whatsapp_rsvp_status: null, pending_marketing_data: null }).eq('id', guestId);

    console.log(`✅ Test Environment Ready. Targeting Guest: ${guests[0].name} | ID: ${guestId}`);

    // --- STEP 1: Send Bridge ---
    console.log(`\n🚀 [STEP 1] Sending Bridge (send-campaign)...`);
    const campaignEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
            eventId: eventId,
            guestIds: [guestId],
            mode: 'invitation' // send-campaign handles bridge internally based on template
        })
    };

    const res1 = await sendCampaignHandler(campaignEvent);
    console.log('--- Bridge Response ---');
    console.log(res1.statusCode, res1.body);

    if (res1.statusCode !== 200) {
        console.log("❌ Failed to send bridge. Stopping flow.");
        return;
    }

    console.log(`⏳ Waiting 5 seconds before simulated click...`);
    await sleep(5000);

    // --- STEP 2: Simulate Click "التفاصيل" (Bridge button) ---
    console.log(`\n🖱️ [STEP 2] Simulating User Click: "التفاصيل" (Bridge)...`);
    // Find the message ID of the bridge to simulate context
    const { data: bridgeMsg } = await supabase.from('whatsapp_messages')
        .select('evolution_message_id')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    
    const bridgeMsgId = bridgeMsg ? bridgeMsg.evolution_message_id : 'wamid.HBgMOTY2NTA3MjQwMDk3FQIAERgSRUI1RUEzOTZFNkQ2REFFOEI5AA==';

    const webhookEvent1 = {
        httpMethod: 'POST',
        body: JSON.stringify({
            object: "whatsapp_business_account",
            entry: [{
                id: "1031606736708015",
                changes: [{
                    value: {
                        messaging_product: "whatsapp",
                        metadata: { display_phone_number: "1234567890", phone_number_id: "1031606736708015" },
                        contacts: [{ profile: { name: "ساره" }, wa_id: "966507240097" }],
                        messages: [{
                            from: "966507240097",
                            id: "wamid.SimulatedReply1",
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            type: "button",
                            button: { payload: "التفاصيل", text: "التفاصيل" },
                            context: {
                                from: "1031606736708015",
                                id: bridgeMsgId
                            }
                        }]
                    },
                    field: "messages"
                }]
            }]
        })
    };

    const res2 = await webhookHandler(webhookEvent1);
    console.log('--- Webhook Response (Bridge Click) ---');
    console.log(res2.statusCode, res2.body);

    console.log(`⏳ Waiting 5 seconds before simulated RSVP...`);
    await sleep(5000);

    // --- STEP 3: Simulate Click "تأكيد الحضور" (RSVP) ---
    console.log(`\n🖱️ [STEP 3] Simulating User Click: "تأكيد الحضور" (RSVP)...`);
    
    // Find the message ID of the invitation sent after bridge
    const { data: inviteMsg } = await supabase.from('whatsapp_messages')
        .select('evolution_message_id')
        .eq('guest_id', guestId)
        .eq('message_phase', 'invitation')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
    const inviteMsgId = inviteMsg ? inviteMsg.evolution_message_id : 'wamid.HBgMOTY2NTA3MjQwMDk3FQIAERgSRUI1RUEzOTZFNkQ2REFFOEI5AA==';

    const webhookEvent2 = {
        httpMethod: 'POST',
        body: JSON.stringify({
            object: "whatsapp_business_account",
            entry: [{
                id: "1031606736708015",
                changes: [{
                    value: {
                        messaging_product: "whatsapp",
                        metadata: { display_phone_number: "1234567890", phone_number_id: "1031606736708015" },
                        contacts: [{ profile: { name: "ساره" }, wa_id: "966507240097" }],
                        messages: [{
                            from: "966507240097",
                            id: "wamid.SimulatedReply2",
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            type: "button",
                            button: { payload: "CONFIRM", text: "تأكيد الحضور" },
                            context: {
                                from: "1031606736708015",
                                id: inviteMsgId
                            }
                        }]
                    },
                    field: "messages"
                }]
            }]
        })
    };

    const res3 = await webhookHandler(webhookEvent2);
    console.log('--- Webhook Response (RSVP Click) ---');
    console.log(res3.statusCode, res3.body);

    console.log('\n✅ TEST DISPATCH EXECUTED. Check WhatsApp for ' + phone);
}

runTahamyFlow();
