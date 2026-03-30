
import 'dotenv/config';

const TEST_PHONE = '966503678789';
const ADAPTER_URL = 'http://127.0.0.1:3010';

async function sendTest() {
    console.log(`🚀 Sending Live Hybrid RSVP Test to ${TEST_PHONE}...`);

    const payload = {
        accountId: 'lony-whatsapp',
        phone: TEST_PHONE,
        message: "يا هلا بك، نتشرف بدعوتك لمناسبتنا السعيدة. نرجو منك تأكيد الحضور من خلال الرد برقم الخيار المفضل:\n\n1️⃣ للتأكيد\n2️⃣ للاعتذار",
        imageUrl: null
    };

    try {
        const res = await fetch(`${ADAPTER_URL}/api/whatsapp/send-demo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('✅ Send Result:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('❌ Failed to send test:', e.message);
    }
}

sendTest();
