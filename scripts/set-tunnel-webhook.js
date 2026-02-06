import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony-whatsapp';
// The Tunnel URL we just got
const WEBHOOK_URL = 'http://192.168.1.131:3001/webhook';

async function setWebhook() {
    console.log(`🔌 Setting Webhook for ${INSTANCE_NAME} to ${WEBHOOK_URL}...`);

    try {
        const response = await fetch(`${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': API_KEY
            },
            body: JSON.stringify({
                webhook: {
                    url: WEBHOOK_URL,
                    events: [
                        "MESSAGES_UPSERT",
                        "MESSAGES_UPDATE",
                        "CONNECTION_UPDATE"
                    ],
                    enabled: true,
                    webhookByEvents: false
                }
            })
        });

        const data = await response.json();
        console.log('✅ Webhook Response:', JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('❌ Error setting webhook:', error.message);
    }
}

setWebhook();
