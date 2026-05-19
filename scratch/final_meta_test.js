/*
 * ULTIMATE NAMED PARAMETER TEST
 */
import fetch from 'node-fetch';
import 'dotenv/config';

const phoneId = process.env.META_PHONE_NUMBER_ID;
const token = process.env.META_ACCESS_TOKEN;
const testNumber = '966503578789'; 

async function tryRaw(label, variables) {
    console.log(`\n🧪 Testing Named Format: ${label}`);
    const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
    
    // Constructing exactly as per Meta Cloud API Examples
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
                        parameter_name: key, // Meta expects this for named templates
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
    // Attempt 1: Standard snake_case
    await tryRaw("Snake Case Names", {
        "guest_name": "ضيف تجريبي",
        "groom_name": "عريس تجريبي",
        "bride_name": "عروس تجريبية",
        "date": "الليلة",
        "location": "قاعة لوني"
    });

    // Attempt 2: Positional as names (Some templates are migrated this way)
    await tryRaw("Positional as Names", {
        "1": "ضيف تجريبي",
        "2": "عريس تجريبي",
        "3": "عروس تجريبية",
        "4": "الليلة",
        "5": "قاعة لوني"
    });
}

start();
