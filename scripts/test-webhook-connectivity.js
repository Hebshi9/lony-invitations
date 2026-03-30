import 'dotenv/config';

// The tunnel URL we established
const TUNNEL_URL = 'http://127.0.0.1:3005/webhook';

async function testWebhook() {
    console.log('🧪 Testing Webhook Connectivity...');

    // Simulate a message from a random number
    const payload = {
        event: "messages.upsert",
        instance: "lony-whatsapp",
        data: {
            key: {
                remoteJid: "966507837584@s.whatsapp.net",
                fromMe: false,
                id: "TEST_MSG_ID"
            },
            message: {
                conversation: "1"
            }
        }
    };

    try {
        const res = await fetch(TUNNEL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`Response Status: ${res.status}`);
        console.log(`Response Text: ${await res.text()}`);
    } catch (e) {
        console.error('❌ Failed to reach webhook:', e.message);
    }
}

testWebhook();
