require('dotenv').config();

async function run() {
    const phone = '966535520888'; // Intisar
    console.log(`🚀 PING TEST: Sending raw text to ${phone}...`);
    
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { body: 'هذا اختبار فني للتأكد من وصول الرسائل النصية.' }
    };

    const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
    });

    const resp = await res.json();
    console.log('STATUS:', res.status);
    console.log('RAW RESPONSE:', JSON.stringify(resp, null, 2));
    
    if (resp.error) {
        if (resp.error.code === 131047) {
            console.log('✅ ANALYSIS: Number is VALID on WhatsApp, but free-text is blocked because she hasn\'t replied yet.');
        } else if (resp.error.code === 100 || resp.error.message.includes('not on whatsapp')) {
            console.log('❌ ANALYSIS: Number is INVALID or not registered on WhatsApp.');
        }
    } else {
        console.log('✅ ANALYSIS: Message SENT (Window is open).');
    }
}

run();
