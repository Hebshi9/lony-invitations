/**
 * 📨 SEND INVITATIONS WITH IMAGES + PERSONAL CARDS
 * 
 * Flow:
 * 1. Send general.jpg + invitation text to both numbers
 * 2. When guest replies "1" or "تأكيد" → bot sends their personal barcode card
 * 3. When guest replies "2" or "اعتذار" → bot replies politely
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVOLUTION_URL = 'http://localhost:8081';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony';
const SERVER_URL = 'http://host.docker.internal:3001';

const SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';

const CARDS_DIR = path.join(__dirname, '..', 'test-cards');

// === GUESTS CONFIG ===
const GUESTS = [
    { phone: '966503678789', name: 'أحمد', cardFile: 'ahmed.png' },
    { phone: '966507240097', name: 'سارة', cardFile: 'sara.png' }
];

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function evoSend(endpoint, body) {
    const resp = await fetch(`${EVOLUTION_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify(body)
    });
    return await resp.json();
}

async function supabaseReq(endpoint, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, opts);
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return text; }
}

async function main() {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║  📨 إرسال دعوات مع صور + كروت شخصية         ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    // === CHECK FILES ===
    const generalPath = path.join(CARDS_DIR, 'general.jpg');
    if (!fs.existsSync(generalPath)) {
        console.log('❌ general.jpg not found in test-cards/');
        return;
    }
    console.log('✅ general.jpg found');

    for (const g of GUESTS) {
        const cardPath = path.join(CARDS_DIR, g.cardFile);
        if (fs.existsSync(cardPath)) {
            g.cardUrl = `${SERVER_URL}/cards/${g.cardFile}`;
            console.log(`✅ ${g.cardFile} found → URL: ${g.cardUrl}`);
        } else {
            console.log(`⚠️ ${g.cardFile} NOT found`);
        }
    }

    // === CHECK EVOLUTION ===
    console.log('\n🔍 Checking Evolution API...');
    try {
        const stateResp = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        const state = await stateResp.json();
        if (state?.instance?.state !== 'open') {
            console.log('❌ Instance "lony" NOT connected! Start Docker and connect first.');
            return;
        }
        console.log('🟢 WhatsApp متصل\n');
    } catch (e) {
        console.log('❌ Evolution API not reachable. Is Docker running?');
        return;
    }

    // === REGISTER WEBHOOK (ensure it's set) ===
    console.log('🔗 Registering webhook...');
    await evoSend(`/webhook/set/${INSTANCE_NAME}`, {
        url: `${SERVER_URL}/webhook`,
        webhook_by_events: false,
        webhook_base64: false,
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
    });
    console.log('✅ Webhook registered\n');

    // === GET/CREATE EVENT ===
    let eventId = null;
    const events = await supabaseReq('events?select=id,name&limit=1');
    if (Array.isArray(events) && events.length > 0) {
        eventId = events[0].id;
        console.log(`📋 Event: ${events[0].name}`);
    } else {
        const newEvent = await supabaseReq('events', 'POST', {
            name: 'حفل تخرج - تجريبي',
            event_date: '2026-06-26',
            location: 'فندق هدب الصحافة',
            status: 'active'
        });
        eventId = newEvent?.[0]?.id;
    }
    if (!eventId) { console.log('❌ No event'); return; }

    // === READ GENERAL CARD AS BASE64 ===
    const generalBase64 = fs.readFileSync(generalPath, { encoding: 'base64' });
    const generalMedia = `data:image/jpeg;base64,${generalBase64}`;

    // === SEND TO EACH GUEST ===
    for (const g of GUESTS) {
        console.log(`\n${'═'.repeat(50)}`);
        console.log(`📤 إرسال إلى: ${g.name} (${g.phone})`);
        console.log('═'.repeat(50));

        // 1. Create guest record with personal card URL
        await supabaseReq(`guests?phone=eq.${g.phone}&event_id=eq.${eventId}`, 'DELETE');

        const guestResult = await supabaseReq('guests', 'POST', {
            name: g.name,
            phone: g.phone,
            event_id: eventId,
            rsvp_status: 'pending',
            category: 'vip',
            card_image_url: g.cardUrl || null
        });

        const guestId = guestResult?.[0]?.id;
        console.log(`   👤 Guest created: ${guestId || 'error'}`);
        if (g.cardUrl) console.log(`   🎫 Personal card: ${g.cardUrl}`);

        // 2. Send general invitation WITH image
        const inviteText = `السلام عليكم ورحمة الله 🌹

يا هلا فيك يا *${g.name}*

تم بحمد الله وفضله التخرج من جامعة الملك فيصل 🎓✨
وحصولي على درجة الدبلوم بتخصص حاسب آلي

يسرنا دعوتك لحضور حفل التخرج

📅 السبت ٦ / ١١ / ١٤٤٧
📍 فندق هدب الصحافة
⏰ الاستقبال ١٢:٠٠ | العشاء ٩:٠٠

بحضوركم تكمل فرحتنا 🌟

1️⃣ للتأكيد
2️⃣ للاعتذار`;

        console.log('   📷 Sending invitation with general card...');

        // Try sendMedia with base64 (raw, no data URL prefix)
        let sendResult = await evoSend(`/message/sendMedia/${INSTANCE_NAME}`, {
            number: g.phone,
            options: { delay: 1200, presence: "composing" },
            mediatype: "image",
            mimetype: "image/jpeg",
            caption: inviteText,
            media: generalBase64,
            fileName: 'invitation.jpg'
        });

        // If that failed, try with data URL prefix
        if (!sendResult?.key?.id) {
            console.log('   🔄 Trying alternative format...');
            sendResult = await evoSend(`/message/sendMedia/${INSTANCE_NAME}`, {
                number: g.phone,
                mediatype: "image",
                caption: inviteText,
                media: generalMedia
            });
        }

        // If image still failed, send text + image separately
        if (!sendResult?.key?.id) {
            console.log('   🔄 Sending text + image separately...');
            // Send text first
            sendResult = await evoSend(`/message/sendText/${INSTANCE_NAME}`, {
                number: g.phone,
                options: { delay: 1200, presence: "composing" },
                text: inviteText
            });

            // Then send image
            await delay(2000);
            await evoSend(`/message/sendMedia/${INSTANCE_NAME}`, {
                number: g.phone,
                mediatype: "image",
                media: generalBase64,
                mimetype: "image/jpeg",
                fileName: 'invitation.jpg'
            });
        }

        if (sendResult?.key?.id) {
            console.log(`   ✅ تم الإرسال بنجاح! ID: ${sendResult.key.id}`);

            // Log in DB for webhook context
            if (guestId) {
                await supabaseReq('whatsapp_messages', 'POST', {
                    event_id: eventId,
                    guest_id: guestId,
                    phone: g.phone,
                    message_text: inviteText,
                    message_phase: 'invite',
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    evolution_message_id: sendResult.key.id
                });
                console.log('   📝 Message logged in DB');
            }
        } else {
            console.log('   ⚠️ Result:', JSON.stringify(sendResult).substring(0, 300));
        }

        await delay(4000);
    }

    // === DONE ===
    console.log('\n\n╔═══════════════════════════════════════════════╗');
    console.log('║           ✅ تم الإرسال!                       ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log('║                                               ║');
    console.log('║ 📱 الدعوة + الصورة العامة وصلت للرقمين       ║');
    console.log('║                                               ║');
    console.log('║ الآن جرّب:                                    ║');
    console.log('║   رد "1" أو "تأكيد" أو "ان شاء الله"        ║');
    console.log('║   → البوت يرد + يرسل الكرت الشخصي           ║');
    console.log('║                                               ║');
    console.log('║   رد "2" أو "اعتذار" أو "ما أقدر"           ║');
    console.log('║   → البوت يرد بلباقة                         ║');
    console.log('║                                               ║');
    console.log('╚═══════════════════════════════════════════════╝');
}

main().catch(e => console.error('❌ Error:', e));
