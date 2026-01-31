import fetch from 'node-fetch';

async function testAPI() {
    console.log('🧪 Testing WhatsApp API...\n');

    // 1. Check server status
    try {
        const statusRes = await fetch('http://localhost:3001/api/whatsapp/status');
        const status = await statusRes.json();
        console.log('✅ Server Status:', status);
    } catch (error) {
        console.error('❌ Server not reachable:', error.message);
        return;
    }

    // 2. Check accounts
    try {
        const accountsRes = await fetch('http://localhost:3001/api/whatsapp/accounts');
        const accounts = await accountsRes.json();
        console.log('\n📱 Accounts:', accounts);
    } catch (error) {
        console.error('❌ Failed to get accounts:', error.message);
    }

    // 3. Try to send a test batch
    try {
        console.log('\n📤 Attempting to send batch...');
        const sendRes = await fetch('http://localhost:3001/api/whatsapp/send-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId: 'fbb9013e-1b3b-4b7e-901c-e3bee46ee0b7' // من الصورة
            })
        });

        const result = await sendRes.json();
        console.log('\n📊 Send Result:', result);
    } catch (error) {
        console.error('\n❌ Send failed:', error.message);
    }
}

testAPI();
