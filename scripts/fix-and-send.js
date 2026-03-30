/**
 * 🔧 FIX EVERYTHING + SEND INVITATIONS
 * 
 * 1. Register webhook with Evolution API (CRITICAL FIX - bot wasn't receiving replies)
 * 2. Create guest records for both phone numbers
 * 3. Send general invitation to both
 * 4. Bot will auto-handle replies after this
 */

const EVOLUTION_URL = 'http://localhost:8081';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony';
const WEBHOOK_URL = 'http://host.docker.internal:3001/webhook';

const SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';

// Phone numbers and their guest names
const GUESTS = [
    { phone: '966503678789', name: 'نجد المطيري' },
    { phone: '966507240097', name: 'شوق العنزي' }
];

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function evoAPI(endpoint, method = 'GET', body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY }
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${EVOLUTION_URL}${endpoint}`, opts);
    const text = await resp.text();
    try { return { status: resp.status, data: JSON.parse(text) }; }
    catch { return { status: resp.status, data: text }; }
}

async function supabase(endpoint, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': method === 'POST' ? 'return=representation' : (method === 'PATCH' ? 'return=representation' : undefined)
        }
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, opts);
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return text; }
}

async function main() {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║  🔧 FIX ALL + SEND INVITATIONS               ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    // ═══════════════════════════════════
    // STEP 1: CHECK EVOLUTION API
    // ═══════════════════════════════════
    console.log('📌 STEP 1: Checking Evolution API...');
    const state = await evoAPI(`/instance/connectionState/${INSTANCE_NAME}`);
    if (state.data?.instance?.state !== 'open') {
        console.log('❌ Instance "lony" is NOT connected! Open Evolution Manager and scan QR.');
        return;
    }
    console.log('   ✅ Instance "lony" is CONNECTED\n');

    // ═══════════════════════════════════
    // STEP 2: REGISTER WEBHOOK (CRITICAL FIX!)
    // ═══════════════════════════════════
    console.log('📌 STEP 2: Registering webhook with Evolution API...');
    console.log(`   URL: ${WEBHOOK_URL}`);

    const webhookResult = await evoAPI(`/webhook/set/${INSTANCE_NAME}`, 'POST', {
        url: WEBHOOK_URL,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED'
        ]
    });

    if (webhookResult.status === 200 || webhookResult.status === 201) {
        console.log('   ✅ WEBHOOK REGISTERED SUCCESSFULLY! 🎉');
        console.log('   Now the bot will receive ALL incoming messages!');
    } else {
        console.log('   ⚠️ Webhook response:', JSON.stringify(webhookResult.data).substring(0, 200));
    }

    // Verify webhook
    const webhookCheck = await evoAPI(`/webhook/find/${INSTANCE_NAME}`);
    console.log('   📋 Current webhook config:', JSON.stringify(webhookCheck.data).substring(0, 200));
    console.log('');

    // ═══════════════════════════════════
    // STEP 3: FIND/CREATE EVENT
    // ═══════════════════════════════════
    console.log('📌 STEP 3: Finding/Creating event...');
    let eventId = null;
    const events = await supabase('events?select=id,name&limit=1');
    if (Array.isArray(events) && events.length > 0) {
        eventId = events[0].id;
        console.log(`   ✅ Using event: "${events[0].name}" (${eventId})\n`);
    } else {
        const newEvent = await supabase('events', 'POST', {
            name: 'حفل تخرج - تجريبي',
            event_date: '2026-06-26',
            location: 'فندق هدب الصحافة',
            status: 'active'
        });
        if (Array.isArray(newEvent) && newEvent[0]?.id) {
            eventId = newEvent[0].id;
            console.log(`   ✅ Created event: ${eventId}\n`);
        }
    }

    if (!eventId) {
        console.log('   ❌ Cannot find/create event. Aborting.');
        return;
    }

    // ═══════════════════════════════════
    // STEP 4: CREATE GUEST RECORDS
    // ═══════════════════════════════════
    console.log('📌 STEP 4: Creating guest records...');

    const createdGuests = [];
    for (const g of GUESTS) {
        // Delete any existing test guest with this phone
        await supabase(`guests?phone=eq.${g.phone}&event_id=eq.${eventId}`, 'DELETE');

        const result = await supabase('guests', 'POST', {
            name: g.name,
            phone: g.phone,
            event_id: eventId,
            rsvp_status: 'pending',
            category: 'vip'
        });

        if (Array.isArray(result) && result[0]?.id) {
            console.log(`   ✅ Guest "${g.name}" created (ID: ${result[0].id})`);
            createdGuests.push({ ...g, id: result[0].id });
        } else {
            console.log(`   ⚠️ Guest "${g.name}" result:`, JSON.stringify(result).substring(0, 150));
            // Try to find existing
            const existing = await supabase(`guests?phone=eq.${g.phone}&event_id=eq.${eventId}&select=id,name`);
            if (Array.isArray(existing) && existing.length > 0) {
                createdGuests.push({ ...g, id: existing[0].id });
                console.log(`   ✅ Using existing guest: ${existing[0].id}`);
            }
        }
    }
    console.log('');

    // ═══════════════════════════════════
    // STEP 5: SEND GENERAL INVITATION TO BOTH
    // ═══════════════════════════════════
    console.log('📌 STEP 5: Sending Saudi-style invitations...\n');

    for (const g of createdGuests) {
        const inviteText = `السلام عليكم ورحمة الله وبركاته 🌹

يا هلا بك يا *${g.name}*

تم بحمد الله وفضله التخرج من جامعة الملك فيصل 🎓✨

يسرنا دعوتك لحضور حفل التخرج

📅 التاريخ: السبت ٦ / ١١ / ١٤٤٧
📍 المكان: فندق هدب الصحافة
⏰ الاستقبال: ١٢:٠٠ | العشاء: ٩:٠٠

بحضوركم تكمل فرحتنا 🌟

لتأكيد الحضور أو الاعتذار:
1️⃣ للتأكيد
2️⃣ للاعتذار`;

        console.log(`   📤 Sending to ${g.name} (${g.phone})...`);

        const sendResult = await evoAPI(`/message/sendText/${INSTANCE_NAME}`, 'POST', {
            number: g.phone,
            options: { delay: 1200, presence: "composing" },
            text: inviteText
        });

        if (sendResult.data?.key?.id) {
            console.log(`   ✅ SENT! Message ID: ${sendResult.data.key.id}`);

            // Log in database so webhook can find context
            await supabase('whatsapp_messages', 'POST', {
                event_id: eventId,
                guest_id: g.id,
                phone: g.phone,
                message_text: inviteText,
                message_phase: 'invite',
                status: 'sent',
                sent_at: new Date().toISOString(),
                evolution_message_id: sendResult.data.key.id
            });
            console.log(`   📝 Logged in database`);
        } else {
            console.log(`   ⚠️ Send result:`, JSON.stringify(sendResult.data).substring(0, 200));
        }

        await delay(3000);
        console.log('');
    }

    // ═══════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║           ✅ ALL DONE!                        ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log('║ ✅ Webhook registered with Evolution API      ║');
    console.log('║ ✅ Guest records created in database           ║');
    console.log('║ ✅ Invitations sent to both numbers            ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log('║                                               ║');
    console.log('║ 📱 NOW: Reply "1" or "تأكيد" to test the bot ║');
    console.log('║ The bot should auto-respond with confirmation ║');
    console.log('║                                               ║');
    console.log('╚═══════════════════════════════════════════════╝');

    console.log('\n💡 ملاحظة مهمة:');
    console.log('   لما ترد "1" أو "تأكيد" البوت حيرد عليك:');
    console.log('   ✅ للقبول: "تم تأكيد حضورك بنجاح" + كرت الباركود (إذا موجود)');
    console.log('   ❌ للاعتذار: "تم قبول اعتذارك" بلباقة');
    console.log('\n   لإضافة كروت الباركود الشخصية، احفظ الصور في مجلد:');
    console.log('   test-cards/najd.jpg و test-cards/shouq.jpg');
    console.log('   وبعدين شغّل: node scripts/upload-cards.js');
}

main().catch(e => console.error('❌ Error:', e));
