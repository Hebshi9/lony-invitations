/**
 * 📨 Send Saudi Invitation to specific numbers
 * Uses Evolution API directly (bypasses adapter instance resolution issues)
 */

const EVOLUTION_URL = 'http://localhost:8081';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony'; // Direct instance name from Evolution Manager

const PHONES = ['966503678789', '966507240097'];

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function sendToEvolution(endpoint, body) {
    const resp = await fetch(`${EVOLUTION_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify(body)
    });
    return await resp.json();
}

async function sendInvitations() {
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║  📨 إرسال دعوات سعودية للأرقام المحددة       ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    // Check instance first
    try {
        const stateResp = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        const state = await stateResp.json();
        const isOpen = state?.instance?.state === 'open';
        console.log(`📱 Instance "${INSTANCE_NAME}": ${isOpen ? '🟢 متصل' : '🔴 غير متصل'}\n`);
        if (!isOpen) {
            console.log('❌ الرقم مش متصل! افتح Evolution Manager وأعد مسح QR');
            return;
        }
    } catch (e) {
        console.log('❌ Evolution API مش شغّال:', e.message);
        return;
    }

    const invitationText = `السلام عليكم ورحمة الله وبركاته 🌹

يسرنا ويسعدنا دعوتكم لحضور حفل الزفاف 💍✨

📅 التاريخ: الجمعة 1 أبريل 2026
📍 المكان: فندق الفيصلية - الرياض
⏰ الوقت: الساعة 8 مساءً

نتشرف بحضوركم وتشريفكم يا غالين 🌟

لتأكيد الحضور أو الاعتذار:
1️⃣ للتأكيد
2️⃣ للاعتذار`;

    for (const phone of PHONES) {
        console.log(`\n📤 إرسال إلى: ${phone}...`);

        try {
            // Send text message with invitation
            const result = await sendToEvolution(`/message/sendText/${INSTANCE_NAME}`, {
                number: phone,
                options: { delay: 1200, presence: "composing" },
                text: invitationText
            });

            if (result?.key?.id) {
                console.log(`   ✅ تم الإرسال بنجاح! Message ID: ${result.key.id}`);
            } else if (result?.key) {
                console.log(`   ✅ تم الإرسال!`, JSON.stringify(result.key));
            } else {
                console.log(`   ⚠️ النتيجة:`, JSON.stringify(result).substring(0, 200));
            }
        } catch (e) {
            console.log(`   ❌ خطأ:`, e.message);
        }

        // Wait between sends
        if (PHONES.indexOf(phone) < PHONES.length - 1) {
            console.log('   ⏳ انتظار 3 ثواني...');
            await delay(3000);
        }
    }

    console.log('\n\n✅ تم! تحقق من الواتساب على الرقمين 📱');
}

sendInvitations().catch(e => console.error('❌ Error:', e));
