
import 'dotenv/config';

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://localhost:8081';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';
const TEST_PHONE = '966503678789';
const INSTANCE = 'lony'; // Adjusted instance name based on previous knowledge

async function testDirectSend() {
    console.log(`🧪 Testing Direct Evolution API sendText to ${TEST_PHONE}...`);

    const payload = {
        number: TEST_PHONE,
        text: "هذا اختبار رسالة نصية بسيطة جداً من لوني.\nالرجاء الرد بـ 1 للتأكيد.",
        linkPreview: false
    };

    try {
        const res = await fetch(`${EVOLUTION_URL}/message/sendText/${INSTANCE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVOLUTION_API_KEY
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('✅ Result Status:', res.status);
        console.log('✅ Result Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('❌ Failed:', e.message);
    }
}

testDirectSend();
