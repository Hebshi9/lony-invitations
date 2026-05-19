/*
 * CALIBRATE VARIABLES COUNT
 */
import fetch from 'node-fetch';
import 'dotenv/config';

const phoneId = process.env.META_PHONE_NUMBER_ID;
const token = process.env.META_ACCESS_TOKEN;
const testNumber = '966503578789'; 

async function tryVars(label, variables) {
    console.log(`\n🧪 Testing: ${label}`);
    const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
    
    const body = {
        messaging_product: "whatsapp",
        to: testNumber,
        type: "template",
        template: {
            name: "lony",
            language: { code: "ar" },
            components: [
                {
                    type: "header",
                    parameters: [{ type: "image", image: { link: "https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/demo_card.png" } }]
                },
                {
                    type: "body",
                    parameters: Object.entries(variables).map(([key, val]) => ({
                        type: "text",
                        parameter_name: key,
                        text: String(val)
                    }))
                }
            ]
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log(`Result: ${JSON.stringify(data)}`);
}

async function start() {
    // Test 1: Only 2 variables (based on Meta Example)
    await tryVars("2 Variables (Guest + Sender)", {
        "guest_name": "ضيف لوني",
        "sender_name": "إدارة لوني"
    });

    // Test 2: All 5 variables (based on Template Text)
    await tryVars("5 Variables (The Full Mapping)", {
        "guest_name": "ضيف لوني",
        "groom_name": "محمد",
        "bride_name": "سارة",
        "event_date": "الليلة",
        "event_location": "القاعة"
    });
}

start();
