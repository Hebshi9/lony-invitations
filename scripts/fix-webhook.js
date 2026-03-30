/**
 * 🔧 Fix webhook URL - change port from 3010 to 3001
 */
const EVOLUTION_URL = 'http://localhost:8081';
const EVOLUTION_API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const CORRECT_WEBHOOK = 'http://host.docker.internal:3001/webhook';

async function main() {
    console.log('🔧 Fixing webhook URL...\n');
    console.log('❌ Old: http://host.docker.internal:3010/webhook (WRONG PORT)');
    console.log('✅ New: http://host.docker.internal:3001/webhook (CORRECT)\n');

    // Try all methods to set the correct URL
    const methods = [
        { endpoint: '/webhook/set/lony', method: 'POST', body: { url: CORRECT_WEBHOOK, webhook_by_events: false, webhook_base64: false, events: ['MESSAGES_UPSERT'] } },
        { endpoint: '/webhook/set/lony', method: 'PUT', body: { url: CORRECT_WEBHOOK, webhook_by_events: false, webhook_base64: false, events: ['MESSAGES_UPSERT'] } },
        { endpoint: '/webhook/set/lony', method: 'POST', body: { webhook: { url: CORRECT_WEBHOOK, events: ['MESSAGES_UPSERT'] } } },
        { endpoint: '/webhook/set/lony', method: 'POST', body: { enabled: true, url: CORRECT_WEBHOOK, events: ['MESSAGES_UPSERT'] } },
    ];

    for (let i = 0; i < methods.length; i++) {
        const m = methods[i];
        console.log(`🧪 Attempt ${i + 1}: ${m.method} ${m.endpoint}...`);
        try {
            const resp = await fetch(`${EVOLUTION_URL}${m.endpoint}`, {
                method: m.method,
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                body: JSON.stringify(m.body)
            });
            const data = await resp.json();
            if (resp.status >= 200 && resp.status < 300) {
                console.log(`   ✅ SUCCESS! Status: ${resp.status}`);
                break;
            } else {
                console.log(`   ❌ Failed (${resp.status}):`, JSON.stringify(data).substring(0, 150));
            }
        } catch (e) {
            console.log(`   ❌ Error:`, e.message);
        }
    }

    // Verify
    console.log('\n📋 Verifying webhook config...');
    const resp = await fetch(`${EVOLUTION_URL}/webhook/find/lony`, {
        headers: { 'apikey': EVOLUTION_API_KEY }
    });
    const config = await resp.json();
    console.log('   URL:', config.url || JSON.stringify(config).substring(0, 200));

    if (config.url === CORRECT_WEBHOOK) {
        console.log('\n🎉 WEBHOOK FIXED! البوت الآن يستقبل الرسائل على البورت الصحيح 3001');
    } else if (config.url?.includes('3010')) {
        console.log('\n⚠️ URL still shows 3010. Trying Evolution Manager direct update...');
        // Try updating via the Manager API
        try {
            const updateResp = await fetch(`${EVOLUTION_URL}/webhook/lony`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                body: JSON.stringify({ url: CORRECT_WEBHOOK, events: ['MESSAGES_UPSERT'] })
            });
            console.log('   Manager update status:', updateResp.status);
            const updateData = await updateResp.json();
            console.log('   Result:', JSON.stringify(updateData).substring(0, 200));
        } catch (e) {
            console.log('   ❌', e.message);
        }

        console.log('\n💡 إذا ما اشتغل, غيّره يدوي من Evolution Manager:');
        console.log('   1. افتح http://localhost:8081/manager');
        console.log('   2. اختر instance "lony"');
        console.log('   3. روح قسم Webhook');
        console.log('   4. غيّر URL إلى: http://host.docker.internal:3001/webhook');
        console.log('   5. احفظ');
    }
}

main().catch(e => console.error('Error:', e));
