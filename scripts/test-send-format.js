const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
// Use the INSTANCE NAME valid in previous steps
const INSTANCE = '33d6b1c6-7526-4cf1-965f-703649649520';
const PHONE = '966503678789';

async function testSend() {
    console.log('🧪 Testing Message Sending Formats...');

    // Format 1: Standard v2
    const payloads = [
        {
            name: "Format 1 (Standard)",
            url: `/message/sendText/${INSTANCE}`,
            body: {
                number: PHONE,
                text: "Test Format 1"
            }
        },
        {
            name: "Format 2 (Nested)",
            url: `/message/sendText/${INSTANCE}`,
            body: {
                number: PHONE,
                textMessage: { text: "Test Format 2" }
            }
        },
        {
            name: "Format 3 (With JID)",
            url: `/message/sendText/${INSTANCE}`,
            body: {
                number: `${PHONE}@s.whatsapp.net`,
                text: "Test Format 3"
            }
        }
    ];

    for (const p of payloads) {
        console.log(`\nTrying: ${p.name}`);
        try {
            const res = await fetch(`${EVOLUTION_URL}${p.url}`, {
                method: 'POST',
                headers: {
                    'apikey': API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(p.body)
            });
            const data = await res.json();
            console.log(`Status: ${res.status}`);
            console.log(`Response:`, JSON.stringify(data));
        } catch (e) {
            console.error(`Failed: ${e.message}`);
        }
    }
}

testSend();
