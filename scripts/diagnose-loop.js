import 'dotenv/config';

// Config
const LOCAL_SERVER = 'http://localhost:3001';
const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE_NAME = 'lony-whatsapp';
const TEST_PHONE = '966569667344'; // The connected number (self-test) or other
// We will try to send to the connected number itself to see if it delivers, 
// or better, send to a safe admin number if known.
// User mentioned sending to 966569667344 from their personal phone. 
// Let's try to reply to the user's personal phone if we knew it.
// Since we don't know the user's personal phone, we will prompt or just simulate.

async function diagnose() {
    console.log('🚑 STARTING DEEP DIAGNOSIS 🚑\n');

    // 1. Check if Node Server is up
    try {
        const root = await fetch(LOCAL_SERVER);
        console.log(`✅ Local Node Server: UP (${await root.text()})`);
    } catch (e) {
        console.error('❌ Local Node Server: DOWN or Unreachable', e.message);
        console.log('   -> Please run "npm run whatsapp:evolution" in a new terminal.');
        return;
    }

    // 2. Check Evolution Instance
    try {
        const res = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`, {
            headers: { apikey: API_KEY }
        });
        const json = await res.json();
        console.log(`✅ Evolution Instance: ${JSON.stringify(json.instance.state)}`);
    } catch (e) {
        console.error('❌ Evolution API: DOWN or Unreachable', e.message);
    }

    // 3. SIMULATE INCOMING MESSAGE (Webhook Bypass)
    console.log('\n🔄 Simulating Incoming Webhook (Bypass Network Issues)...');

    const fakePayload = {
        event: "messages.upsert",
        instance: INSTANCE_NAME,
        data: {
            key: {
                remoteJid: "966503678789@s.whatsapp.net", // Admin number simulation
                fromMe: false,
                id: "SIMULATED_" + Date.now()
            },
            pushName: "Simulated User",
            message: {
                conversation: "السلام عليكم"
            }
        }
    };

    try {
        const webhookRes = await fetch(`${LOCAL_SERVER}/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fakePayload)
        });

        console.log(`   -> Webhook Simulation Status: ${webhookRes.status} ${webhookRes.statusText}`);

        if (webhookRes.status === 200) {
            console.log('   ✅ Node Server processed the webhook successfully.');
            console.log('   👀 CHECK TERMINAL OF SERVER: You should see "Processing... Intent..." logs.');
        } else {
            console.error('   ❌ Node Server returned error:', await webhookRes.text());
        }

    } catch (e) {
        console.error('   ❌ Failed to POST to localhost webhook:', e.message);
    }
}

diagnose();
