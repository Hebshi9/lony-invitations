import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function sendDirectImageTest() {
    const phone = '966503678789';
    const imageUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/qr-sample.png';
    const url = `https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

    console.log(`🚀 Sending direct image to ${phone}...`);

    const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "image",
        image: { link: imageUrl, caption: "هذه صورة تجريبية للكرت 🎫" }
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

sendDirectImageTest();
