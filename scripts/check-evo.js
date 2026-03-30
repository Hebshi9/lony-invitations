import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://localhost:8081';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const TARGET_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'lony';

async function checkEvolution() {
    console.log(`🔍 Checking Evolution API at ${EVOLUTION_URL}...`);
    const headers = { 'apikey': EVOLUTION_API_KEY };

    try {
        // 1. Fetch Instances
        const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, { headers });
        const instances = await res.json();
        console.log('\n--- Instances ---');
        console.log(JSON.stringify(instances, null, 2));

        // 2. Check Webhook for target
        console.log(`\n--- Webhook for ${TARGET_INSTANCE} ---`);
        const webRes = await fetch(`${EVOLUTION_URL}/webhook/find/${TARGET_INSTANCE}`, { headers });
        const webhook = await webRes.json();
        console.log(JSON.stringify(webhook, null, 2));

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

checkEvolution();
