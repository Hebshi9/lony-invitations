import 'dotenv/config';
import fetch from 'node-fetch';

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const RECIPIENT_PHONE = process.env.ADMIN_PHONE || '966503678789'; // Your number

async function sendTest() {
    console.log('🚀 Starting Meta Cloud API Test...');
    console.log(`📡 Using Phone ID: ${PHONE_NUMBER_ID}`);
    
    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    
    const body = {
        messaging_product: "whatsapp",
        to: RECIPIENT_PHONE.replace('+', ''),
        type: "text",
        text: { body: "🛡️ نظام لوني (Lony Invitations)\nهذا اختبار مباشر لـ Meta Cloud API.\nإذا وصلتك هذه الرسالة، فالربط ناجح 100%! ✅" }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        console.log('📦 Meta Response:', JSON.stringify(data, null, 2));

        if (data.messages && data.messages.length > 0) {
            console.log('✅ SUCCESS! Message sent via Meta.');
        } else {
            console.error('❌ FAILED: Check the error in response above.');
        }
    } catch (err) {
        console.error('💥 ERROR during send:', err.message);
    }
}

sendTest();
