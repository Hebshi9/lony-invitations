import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony-whatsapp';

async function checkStatus() {
    console.log(`Checking status for ${INSTANCE_NAME}...`);
    try {
        const response = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`, {
            headers: { 'apikey': API_KEY }
        });
        const data = await response.json();
        console.log('Status:', JSON.stringify(data, null, 2));

        const webhookRes = await fetch(`${EVOLUTION_URL}/webhook/find/${INSTANCE_NAME}`, {
            headers: { 'apikey': API_KEY }
        });
        console.log('Webhook Config:', JSON.stringify(await webhookRes.json(), null, 2));

    } catch (e) {
        console.error(e);
    }
}

checkStatus();
