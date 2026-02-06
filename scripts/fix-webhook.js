import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

// Important: On Windows Docker, the host is 'host.docker.internal'
const WEBHOOK_URL = 'http://host.docker.internal:3001/webhook';

async function setWebhook() {
    console.log('🔄 Configuring Webhook...');
    console.log(`Target: ${WEBHOOK_URL}`);

    try {
        const response = await fetch(`${EVOLUTION_URL}/webhook/find`, {
            method: 'GET',
            headers: {
                'apikey': API_KEY
            }
        });

        // If needed, we set it
        const setResponse = await fetch(`${EVOLUTION_URL}/webhook/set`, {
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

        const data = await setResponse.json();
        console.log('✅ Webhook Response:', JSON.stringify(data, null, 2));

        if (data?.webhook?.url === WEBHOOK_URL) {
            console.log('🎉 Success! Webhook is now pointing to your local server correctly.');
        }

    } catch (error) {
        console.error('❌ Error setting webhook:', error.message);
    }
}

setWebhook();
