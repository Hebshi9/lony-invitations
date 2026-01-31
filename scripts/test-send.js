import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/whatsapp';

async function testSend() {
    console.log('🧪 Testing WhatsApp send functionality...\n');

    // 1. Check accounts
    console.log('1️⃣ Checking accounts...');
    const accountsRes = await fetch(`${API_URL}/accounts`);
    const accountsData = await accountsRes.json();
    console.log('Accounts:', JSON.stringify(accountsData, null, 2));

    if (!accountsData.success || accountsData.accounts.length === 0) {
        console.log('❌ No accounts found!');
        return;
    }

    const connectedAccount = accountsData.accounts.find(a => a.status === 'connected');
    if (!connectedAccount) {
        console.log('❌ No connected accounts!');
        return;
    }

    console.log(`✅ Found connected account: ${connectedAccount.name}\n`);

    // 2. Get first event
    console.log('2️⃣ Getting events...');
    const eventsRes = await fetch(`${API_URL}/../../events`);

    // 3. Try to start sending
    console.log('3️⃣ Attempting to start batch send...');

    // First, let's check the queue status
    const statusRes = await fetch(`${API_URL}/status`);
    const statusData = await statusRes.json();
    console.log('Queue Status:', JSON.stringify(statusData, null, 2));

    // Try to send
    console.log('\n4️⃣ Sending batch request...');
    const sendRes = await fetch(`${API_URL}/send-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            // We'll send without eventId to test
        })
    });

    const sendData = await sendRes.json();
    console.log('Send Response:', JSON.stringify(sendData, null, 2));
}

testSend().catch(console.error);
