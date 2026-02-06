import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony-whatsapp';

async function setup() {
    console.log(`🔄 Setting up instance: ${INSTANCE_NAME}...`);

    try {
        // 1. Create Instance
        const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
            method: 'POST',
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instanceName: INSTANCE_NAME,
                qrcode: true,
                integration: "WHATSAPP-BAILEYS"
            })
        });
        const createData = await createRes.json();
        console.log('📦 Create Result:', JSON.stringify(createData));

        // 2. Connect (Get QR)
        const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`, {
            headers: { 'apikey': API_KEY }
        });
        const connectData = await connectRes.json();

        console.log('\n✨ QR CODE DATA:');
        console.log(connectData.base64 || connectData.code || connectData);

        // 3. Set Webhook
        const WEBHOOK_URL = 'http://host.docker.internal:3001/webhook';
        await fetch(`${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
            body: JSON.stringify({
                url: WEBHOOK_URL,
                webhookByEvents: false,
                events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
                enabled: true
            })
        });
        console.log(`\n🔗 Webhook set to ${WEBHOOK_URL}`);

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

setup();
