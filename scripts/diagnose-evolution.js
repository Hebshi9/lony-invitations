const EVOLUTION_URL = 'http://localhost:8081';
const API_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE = 'lony';

async function diagnose() {
    const headers = {
        'Content-Type': 'application/json',
        'apikey': API_KEY
    };

    console.log('1. Registering Webhook...');
    const webhookPayload = {
        webhook: {
            enabled: true,
            url: 'http://host.docker.internal:3002/webhook/whatsapp',
            webhook_by_events: false,
            events: ['MESSAGES_UPSERT']
        }
    };

    try {
        const whRes = await fetch(`${EVOLUTION_URL}/webhook/set/${INSTANCE}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(webhookPayload)
        });
        const whData = await whRes.json();
        console.log('Webhook Result:', JSON.stringify(whData, null, 2));
    } catch (e) {
        console.error('Webhook Error:', e.message);
    }

    console.log('\n2. Testing Media Send (Image)...');
    const mediaPayload = {
        number: '966503678789',
        mediatype: 'image',
        caption: 'Diagnostic Image Test - احمد الحبشي',
        media: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/bf69d48c-931b-4c6b-9743-2957b1f3c718/47247c82-db5b-47ca-b691-12cfc3bd1a17.jpg',
        fileName: 'card.png'
    };

    try {
        const mRes = await fetch(`${EVOLUTION_URL}/message/sendMedia/${INSTANCE}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(mediaPayload)
        });
        const mData = await mRes.json();
        console.log('Media Result:', JSON.stringify(mData, null, 2));
    } catch (e) {
        console.error('Media Error:', e.message);
    }
}

diagnose();
