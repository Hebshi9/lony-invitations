import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

async function testMetaMessage() {
    const phoneNumber = '966503678789'; // User's number
    const templateName = 'lony';
    const url = `https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`;

    console.log(`🚀 Sending Meta WhatsApp template [${templateName}] to [${phoneNumber}]...`);

    const payload = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "template",
        template: {
            name: templateName,
            language: { code: "ar" },
            components: [
                {
                    type: "header",
                    parameters: [
                        {
                            type: "image",
                            image: { link: "https://lonyinvite.netlify.app/card-placeholder.png" }
                        }
                    ]
                },
                {
                    type: "body",
                    parameters: [
                        { type: "text", parameter_name: "guest_name", text: "أحمد الحبيشي" },
                        { type: "text", parameter_name: "groom_name", text: "أحمد" },
                        { type: "text", parameter_name: "bride_name", text: "العروس" },
                        { type: "text", parameter_name: "event_date", text: "2024-05-20" },
                        { type: "text", parameter_name: "event_location", text: "قاعة الحبشي" }
                    ]
                }
            ]
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
            console.log('✅ Test message sent successfully!');
            console.log('Message ID:', data.messages[0].id);
        } else {
            console.error('❌ Error sending message:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('❌ Exception during fetch:', e.message);
    }
}

testMetaMessage();
