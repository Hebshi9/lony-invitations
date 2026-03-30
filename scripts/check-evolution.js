/**
 * Quick check: Is Evolution API running and what instances exist?
 */
const EVOLUTION_URL = 'http://localhost:8081';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';

async function check() {
    console.log('🔍 Checking Evolution API at', EVOLUTION_URL, '...\n');

    // 1. Health check
    try {
        const resp = await fetch(EVOLUTION_URL, {
            headers: { 'apikey': EVOLUTION_API_KEY },
            signal: AbortSignal.timeout(5000)
        });
        console.log('✅ Evolution API is reachable. Status:', resp.status);
    } catch (e) {
        console.log('❌ Evolution API is NOT reachable:', e.message);
        console.log('\n🛑 هل Docker شغّال؟ شغّل هذا الأمر:');
        console.log('   docker ps');
        console.log('   أو شغّل Evolution: docker compose up -d');
        return;
    }

    // 2. Fetch instances
    try {
        const resp = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
            headers: { 'apikey': EVOLUTION_API_KEY }
        });
        const data = await resp.json();
        const instances = Array.isArray(data) ? data : (data.data || []);

        console.log(`\n📋 Found ${instances.length} instance(s):\n`);

        for (const inst of instances) {
            const name = inst.instanceName || inst.name || 'Unknown';
            const status = inst.connectionStatus || inst.state || inst.status || 'unknown';
            const owner = inst.owner || inst.ownerJid || 'N/A';
            const icon = (status === 'open' || status === 'connected') ? '🟢' : '🔴';
            console.log(`${icon} Instance: "${name}"`);
            console.log(`   Status: ${status}`);
            console.log(`   Owner: ${owner}`);
            console.log('');
        }

        // 3. If instance is closed, try to get QR or reconnect
        const lonyInst = instances.find(i => (i.instanceName || i.name) === 'lony');
        if (lonyInst) {
            const lonyStatus = lonyInst.connectionStatus || lonyInst.state || '';
            if (lonyStatus !== 'open' && lonyStatus !== 'connected') {
                console.log('⚠️ Instance "lony" is NOT connected.');
                console.log('   👉 افتح Evolution Manager وأعد مسح QR Code');
                console.log(`   👉 رابط المانجر: ${EVOLUTION_URL}/manager`);

                // Try to connect
                console.log('\n🔄 Attempting to reconnect...');
                const connectResp = await fetch(`${EVOLUTION_URL}/instance/connect/lony`, {
                    headers: { 'apikey': EVOLUTION_API_KEY }
                });
                const connectData = await connectResp.json();
                if (connectData.base64) {
                    console.log('📱 QR Code generated! Open the Manager to scan it.');
                } else {
                    console.log('   Connect response:', JSON.stringify(connectData).substring(0, 200));
                }
            } else {
                console.log('✅ Instance "lony" is CONNECTED and ready to send!');
            }
        }
    } catch (e) {
        console.log('❌ Error fetching instances:', e.message);
    }
}

check();
