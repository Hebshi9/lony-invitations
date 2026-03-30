/**
 * 🧪 Full Realistic Test: Saudi Invitation + Image + RSVP Bot
 * 
 * Step 1: Create test guest in Supabase
 * Step 2: Send invitation with image + Saudi text + 1/2 options
 * Step 3: Simulate guest reply "1" (accept) via webhook
 * Step 4: Check if guest status updated to "confirmed"
 */

const API = 'http://localhost:3001';
const SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';

// Test phone = the connected account phone (sends to itself)
const TEST_PHONE = '966507837584';
const ACCOUNT_ID = '863eecda-90a5-4cf4-88b7-e546a69da41d';

// Sample invitation image (public URL)
const INVITE_IMAGE = 'https://i.ibb.co/6rBq7rR/demo-qr-card.png';

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function supabaseRequest(endpoint, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'return=representation' : undefined
        }
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, opts);
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return text; }
}

async function fetchAPI(path, method = 'GET', body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${API}${path}`, opts);
    const text = await resp.text();
    try { return { status: resp.status, data: JSON.parse(text) }; } catch { return { status: resp.status, data: text }; }
}

async function runRealisticTest() {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║  🧪 REALISTIC INVITATION + RSVP BOT TEST     ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    // ═════════════════════════════════════
    // STEP 1: Find or create a test event
    // ═════════════════════════════════════
    console.log('📌 STEP 1: Finding/Creating test event...');

    let eventId = null;
    const events = await supabaseRequest('events?select=id,name&limit=1');
    if (Array.isArray(events) && events.length > 0) {
        eventId = events[0].id;
        console.log(`   ✅ Using existing event: "${events[0].name}" (${eventId})`);
    } else {
        console.log('   ⚠️ No events found. Creating test event...');
        const newEvent = await supabaseRequest('events', 'POST', {
            name: 'حفل اختبار لوني',
            event_date: '2026-04-01',
            location: 'الرياض - فندق الفيصلية',
            status: 'active'
        });
        if (Array.isArray(newEvent) && newEvent[0]?.id) {
            eventId = newEvent[0].id;
            console.log(`   ✅ Created event: ${eventId}`);
        } else {
            console.log('   ❌ Could not create event:', JSON.stringify(newEvent).substring(0, 200));
            return;
        }
    }

    // ═════════════════════════════════════
    // STEP 2: Create test guest
    // ═════════════════════════════════════
    console.log('\n📌 STEP 2: Creating test guest...');

    // Clean up any previous test guest
    await supabaseRequest(`guests?phone=eq.${TEST_PHONE}&event_id=eq.${eventId}`, 'DELETE');

    const guestData = await supabaseRequest('guests', 'POST', {
        name: 'أبو تركي (تجريبي)',
        phone: TEST_PHONE,
        event_id: eventId,
        rsvp_status: 'pending',
        category: 'vip'
    });

    let guestId = null;
    if (Array.isArray(guestData) && guestData[0]?.id) {
        guestId = guestData[0].id;
        console.log(`   ✅ Guest created: "${guestData[0].name}" (${guestId})`);
    } else {
        console.log('   ⚠️ Guest creation response:', JSON.stringify(guestData).substring(0, 200));
        // Try to find existing
        const existing = await supabaseRequest(`guests?phone=eq.${TEST_PHONE}&event_id=eq.${eventId}&select=id,name`);
        if (Array.isArray(existing) && existing.length > 0) {
            guestId = existing[0].id;
            console.log(`   ✅ Using existing guest: ${guestId}`);
        } else {
            console.log('   ❌ Cannot create or find test guest. Aborting.');
            return;
        }
    }

    // ═════════════════════════════════════
    // STEP 3: Send invitation message
    // ═════════════════════════════════════
    console.log('\n📌 STEP 3: Sending Saudi-style invitation with image...');

    const invitationText = `السلام عليكم ورحمة الله وبركاته 🌹

يا هلا بك يا أبو تركي

يسرنا ويسعدنا دعوتك لحضور حفلنا بمناسبة زواج ابننا 💍✨

📅 التاريخ: الجمعة 1 أبريل 2026
📍 المكان: فندق الفيصلية - الرياض
⏰ الوقت: الساعة 8 مساءً

نتشرف بحضورك وتشريفك يا غالي 🌟

1️⃣ للتأكيد
2️⃣ للاعتذار`;

    const sendResult = await fetchAPI('/api/whatsapp/send', 'POST', {
        accountId: ACCOUNT_ID,
        phone: TEST_PHONE,
        message: invitationText,
        imageUrl: INVITE_IMAGE
    });

    if (sendResult.data?.success || sendResult.data?.key) {
        console.log('   ✅ Invitation SENT successfully! 🚀');
        console.log('   📱 Check your WhatsApp - you should receive the invitation with image');
    } else {
        console.log('   ⚠️ Send result:', JSON.stringify(sendResult.data).substring(0, 300));
    }

    // Also log the message in whatsapp_messages for webhook context
    await supabaseRequest('whatsapp_messages', 'POST', {
        event_id: eventId,
        guest_id: guestId,
        phone: TEST_PHONE,
        message_text: invitationText,
        image_url: INVITE_IMAGE,
        message_phase: 'invite',
        status: 'sent',
        sent_at: new Date().toISOString()
    });
    console.log('   📝 Message logged in database');

    // ═════════════════════════════════════
    // STEP 4: Wait then simulate guest reply
    // ═════════════════════════════════════
    console.log('\n📌 STEP 4: Waiting 5 seconds, then simulating guest reply "1" (accept)...');
    await delay(5000);

    // Simulate a webhook call as if the guest replied "1"
    const webhookPayload = {
        event: 'messages.upsert',
        instance: 'lony',
        data: {
            key: {
                remoteJid: `${TEST_PHONE}@s.whatsapp.net`,
                fromMe: false,
                id: 'TEST_' + Date.now()
            },
            message: {
                conversation: '1'
            },
            messageType: 'conversation',
            messageTimestamp: Math.floor(Date.now() / 1000)
        }
    };

    console.log('   📨 Sending simulated reply to webhook...');
    const webhookResult = await fetchAPI('/webhook', 'POST', webhookPayload);
    console.log('   Webhook response status:', webhookResult.status);

    // ═════════════════════════════════════
    // STEP 5: Wait and check RSVP status
    // ═════════════════════════════════════
    console.log('\n📌 STEP 5: Waiting 5 seconds for RSVP processing...');
    await delay(5000);

    const updatedGuest = await supabaseRequest(`guests?id=eq.${guestId}&select=id,name,rsvp_status,rsvp_at`);

    if (Array.isArray(updatedGuest) && updatedGuest.length > 0) {
        const g = updatedGuest[0];
        const statusIcon = g.rsvp_status === 'confirmed' ? '✅' : g.rsvp_status === 'declined' ? '❌' : '⏳';
        console.log(`\n   ${statusIcon} Guest RSVP Status: ${g.rsvp_status}`);
        console.log(`   📅 RSVP At: ${g.rsvp_at || 'N/A'}`);

        if (g.rsvp_status === 'confirmed') {
            console.log('\n   🎉 SUCCESS! Guest was automatically confirmed by the bot!');
        } else if (g.rsvp_status === 'maybe') {
            console.log('\n   ⚠️ Guest marked as "maybe" (low AI confidence). Manual review needed.');
        } else {
            console.log('\n   ⚠️ Status is still:', g.rsvp_status, '- The webhook/AI might need more time or has an issue.');
        }
    } else {
        console.log('   ❌ Could not fetch updated guest data');
    }

    // Check replies table
    const replies = await supabaseRequest(`whatsapp_replies?guest_id=eq.${guestId}&select=*&order=created_at.desc&limit=1`);
    if (Array.isArray(replies) && replies.length > 0) {
        console.log('\n   📋 Reply recorded in DB:');
        console.log(`      Text: "${replies[0].reply_text}"`);
        console.log(`      RSVP Response: ${replies[0].rsvp_response}`);
        console.log(`      AI Confidence: ${replies[0].ai_confidence}`);
    }

    // ═════════════════════════════════════
    // FINAL SUMMARY
    // ═════════════════════════════════════
    console.log('\n\n╔═══════════════════════════════════════════════╗');
    console.log('║           📊 TEST RESULTS                      ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log('║ ✅ Event found/created                         ║');
    console.log('║ ✅ Guest created                                ║');
    console.log(`║ ${sendResult.data?.success || sendResult.data?.key ? '✅' : '⚠️'} Invitation sent with image                 ║`);
    console.log(`║ ${webhookResult.status === 200 ? '✅' : '❌'} Webhook received reply                      ║`);

    const finalGuest = await supabaseRequest(`guests?id=eq.${guestId}&select=rsvp_status`);
    const finalStatus = Array.isArray(finalGuest) && finalGuest[0] ? finalGuest[0].rsvp_status : 'unknown';
    console.log(`║ ${finalStatus === 'confirmed' ? '✅' : '⚠️'} RSVP Bot auto-confirmed: ${finalStatus.padEnd(18)} ║`);
    console.log('╚═══════════════════════════════════════════════╝');

    // Cleanup hint
    console.log('\n💡 Check your WhatsApp! You should have received:');
    console.log('   1. The invitation message with image');
    console.log('   2. A confirmation response from the bot (if RSVP worked)');
}

runRealisticTest().catch(e => console.error('❌ Test error:', e));
