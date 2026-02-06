import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:3001/webhook';

async function simulateWebhook() {
    console.log('🧪 Simulating Evolution API Webhook...\n');

    const testMessages = [
        {
            phone: '966500000001',
            text: 'يا هلا، ممكن تشرح لي وش الخدمات اللي تقدمونها؟',
            description: 'Sales Inquiry (New Client)'
        },
        {
            phone: '966500000002',
            text: 'أبي أحجز دعوة إلكترونية لزواجي الشهر الجاي، وش العروض؟',
            description: 'Sales Negotiation'
        },
        {
            phone: '966533161040', // Example guest phone from previous logs if any
            text: 'ان شاء الله حاضرين',
            description: 'RSVP Confirmation (Guest)'
        }
    ];

    for (const test of testMessages) {
        console.log(`\n📨 Sending: "${test.text}" (${test.description})`);

        const payload = {
            event: 'messages.upsert',
            instance: 'main-instance',
            data: {
                key: {
                    remoteJid: `${test.phone}@s.whatsapp.net`,
                    fromMe: false,
                    id: 'ABC123XYZ'
                },
                message: {
                    conversation: test.text
                },
                messageTimestamp: Math.floor(Date.now() / 1000)
            }
        };

        try {
            const res = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log(`✅ Webhook status: ${res.status}`);
        } catch (error) {
            console.error(`❌ Connection failed: ${error.message}`);
        }
    }
}

simulateWebhook();
