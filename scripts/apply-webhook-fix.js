
const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony';
const WEBHOOK_URL = 'http://192.168.100.55:3002/webhook';

async function applyWebhook() {
    console.log(`🔌 Registering Webhook at ${WEBHOOK_URL} for ${INSTANCE_NAME}...`);

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
                        "MESSAGES_UPDATE"
                    ],
                    enabled: true,
                    webhookByEvents: false
                }
            })
        });

        const data = await response.json();
        console.log('✅ Result:', JSON.stringify(data, null, 2));

        if (data?.webhook?.enabled || data?.enabled || data?.status === 'SUCCESS') {
            console.log('🎉 Webhook is now ACTIVE on Port 3002!');
        } else {
            console.error('❌ Failed to register webhook. Check instance name.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

applyWebhook();
