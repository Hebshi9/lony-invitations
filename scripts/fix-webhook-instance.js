import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
// Use the ID generated from phone number typically
const INSTANCE_ID = '966503678789';

const WEBHOOK_URL = 'http://host.docker.internal:3001/webhook';

async function setInstanceWebhook() {
    console.log(`🔄 Configuring Webhook for instance ${INSTANCE_ID}...`);

    try {
        // Try v2 style: /webhook/set/:instance
        const response = await fetch(`${EVOLUTION_URL}/webhook/set/${INSTANCE_ID}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': API_KEY
            },
            body: JSON.stringify({
                url: WEBHOOK_URL,
                webhookByEvents: false,
                events: [
                    "MESSAGES_UPSERT",
                    "MESSAGES_UPDATE",
                    "CONNECTION_UPDATE"
                ]
            })
        });

        const data = await response.json();
        console.log('✅ Response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

setInstanceWebhook();
