import fetch from 'node-fetch';

async function simulateWebhook(text, phone = '966503678789') {
    console.log(`\n--- Simulating Webhook: "${text}" from ${phone} ---`);
    
    // Note: This script assumes the server is running on localhost:3001
    const payload = {
        event: 'messages_upsert',
        instance: 'lony',
        data: {
            key: {
                remoteJid: `${phone}@s.whatsapp.net`,
                fromMe: false,
                id: 'TEST_MSG_' + Date.now()
            },
            message: {
                conversation: text
            }
        }
    };

    try {
        const res = await fetch('http://localhost:3001/webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        console.log(`Response Status: ${res.status}`);
        if (res.status !== 200) {
            const error = await res.text();
            console.error(`Error: ${error}`);
        }
    } catch (e) {
        console.error(`Fetch Error: ${e.message}`);
        console.log('NOTE: Make sure to run "npm run whatsapp:evolution" (or the server script) before running this test.');
    }
}

async function runTests() {
    // 1. Terminal Confirmation (Existing success case)
    await simulateWebhook('1');
    
    // 2. Dialect Confirmation
    await simulateWebhook('أبشر');
    
    // 3. Dialect "Maybe"
    await simulateWebhook('بشوف');
    
    // 4. Dialect Question
    await simulateWebhook('متى الوقت؟');
}

runTests();
