import 'dotenv/config';

const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const WEBHOOK_URL = 'http://host.docker.internal:3001/webhook';
const INSTANCE_NAME = '33d6b1c6-7526-4cf1-965f-703649649520'; // From previous tool output (partial match, will verify)

async function fix() {
    // 1. Get exact name again just to be sure
    const listRes = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers: { apikey: API_KEY } });
    const list = await listRes.json();
    const target = list[0];

    if (!target) return console.log('❌ No instances found');

    console.log(`🎯 Setting webhook for: ${target.name}`);

    // 2. Set Webhook
    const res = await fetch(`${EVOLUTION_URL}/webhook/set/${target.name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
        body: JSON.stringify({
            url: WEBHOOK_URL,
            webhookByEvents: false,
            events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"],
            enabled: true
        })
    });

    console.log(await res.json());
}

fix();
