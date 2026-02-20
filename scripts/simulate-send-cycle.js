import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api/whatsapp';

async function sendCycle(eventId) {
    console.log(`📨 Starting Send Cycle for Event: ${eventId}\n`);

    // 1. Check Accounts
    console.log('1️⃣ Checking WhatsApp accounts...');
    try {
        const accRes = await fetch(`${API_URL}/accounts`);
        const accData = await accRes.json();
        const connected = accData.accounts.find(a => a.status === 'connected');

        if (!connected) {
            console.log('⚠️ No connected accounts found. Using fallback logic.');
        } else {
            console.log(`✅ Using connected account: ${connected.name} (${connected.phone})`);
        }
    } catch (e) {
        console.error('❌ API Error:', e.message);
        return;
    }

    // 2. Prepare Messages
    console.log('\n2️⃣ Preparing messages in queue...');
    const prepRes = await fetch(`${API_URL}/prepare-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            eventId,
            template: 'يا هلا بـ {name}، ننتظرك في مناسبتنا! هل تؤكد الحضور؟ \n\n {qr_link}',
            messagePhase: 'initial',
            targetAudience: 'all'
        })
    });
    const prepData = await prepRes.json();
    console.log(`✅ Prepared ${prepData.count} messages.`);

    // 3. Start Batch Send
    console.log('\n3️⃣ Starting batch send process...');
    const sendRes = await fetch(`${API_URL}/send-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            eventId,
            mode: 'fast'
        })
    });
    const sendData = await sendRes.json();
    console.log('✅ Batch Send Started:', sendData.message);

    // 4. Poll Status
    console.log('\n4️⃣ Polling status (10 seconds)...');
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`${API_URL}/status/${eventId}`);
        const statusData = await statusRes.json();
        const s = statusData.status.stats;
        console.log(`⏳ Progress: ${s.processed}/${s.total} | Sent: ${s.sent} | Failed: ${s.failed} | Log: ${statusData.status.lastLog}`);
        if (s.processed >= s.total && s.total > 0) break;
    }

    console.log('\n✨ Send Cycle Preparation Complete!');
}

const TEST_EVENT_ID = 'fbb9013e-1b3b-4b7e-901c-e3bee46ee0b7';
sendCycle(TEST_EVENT_ID);
