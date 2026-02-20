import fetch from 'node-fetch';

const WEBHOOK_URL = 'http://localhost:3001/webhook';

async function simulateIncomingMessage(phone, text) {
    console.log(`📩 Simulating message from ${phone}: "${text}"\n`);

    const payload = {
        "event": "messages.upsert",
        "instance": "966503678789",
        "data": {
            "key": {
                "remoteJid": `${phone.replace('+', '')}@s.whatsapp.net`,
                "fromMe": false,
                "id": "SIM_" + Date.now()
            },
            "message": {
                "conversation": text
            }
        }
    };

    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            console.log('✅ Webhook delivery simulated.');
        } else {
            console.error('❌ Webhook simulation failed:', res.status, await res.text());
        }
    } catch (e) {
        console.error('❌ Simulation Error:', e.message);
    }
}

const sarahPhone = '+966507240097';
simulateIncomingMessage(sarahPhone, 'للأسف ما أقدر أحضر، بالتوفيق');
