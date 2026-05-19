import fetch from 'node-fetch';

async function testSend() {
    console.log("🚀 Sending direct invitation to 0503678789...");
    try {
        const res = await fetch('http://localhost:3002/api/send-direct-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: '0503678789',
                type: 'invitation'
            })
        });
        const data = await res.json();
        console.log("✅ Server Response:", data);
    } catch (e) {
        console.error("❌ Failed:", e.message);
    }
}

testSend();
