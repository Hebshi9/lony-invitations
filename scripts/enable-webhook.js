import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony-whatsapp'; // The one we used in HTML file
const WEBHOOK_URL = 'http://192.168.1.131:3001/webhook'; // Target our server via LAN IP

async function enableWebhook() {
    console.log(`🔌 Connecting Webhook for ${INSTANCE_NAME}...`);

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
        console.log('✅ Result:', JSON.stringify(data, null, 2));

        if (data?.webhook?.enabled || data?.enabled) {
            console.log('🎉 Webhook is ACTIVE! AI should reply now.');
        } else {
            // Fallback check
            const findRes = await fetch(`${EVOLUTION_URL}/webhook/find/${INSTANCE_NAME}`, {
                headers: { 'apikey': API_KEY }
            });
            console.log('Current Config:', await findRes.json());
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

enableWebhook();
