/*
 * DEBUG META PAYLOAD FORMATS
 */
import fetch from 'node-fetch';
import 'dotenv/config';

const phoneId = process.env.META_PHONE_NUMBER_ID;
const token = process.env.META_ACCESS_TOKEN;
const testNumber = '966503578789'; // Using what I see in logs or a known test number

async function tryFormat(label, components) {
    console.log(`\n🧪 Testing Format: ${label}`);
    const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
    
    const body = {
        messaging_product: "whatsapp",
        to: testNumber,
        type: "template",
        template: {
            name: "lony",
            language: { code: "ar" },
            components: components
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

async function startDebug() {
    // 1. Pure Positional (Exactly like Netlify)
    await tryFormat("Netlify Style (Positional)", [
        {
            type: "header",
            parameters: [{ type: "image", image: { link: "https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/demo_card.png" } }]
        },
        {
            type: "body",
            parameters: [
                { type: "text", text: "ضيف تجريبي" },
                { type: "text", text: "عريس تجريبي" },
                { type: "text", text: "عروس تجريبية" },
                { type: "text", text: "الليلة" },
                { type: "text", text: "قاعة الاختبار" }
            ]
        }
    ]);

    // 2. Named Positional (using index as parameter_name)
    await tryFormat("Indexed Parameters", [
        {
            type: "header",
            parameters: [{ type: "image", image: { link: "https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/demo_card.png" } }]
        },
        {
            type: "body",
            parameters: [
                { type: "text", parameter_name: "1", text: "ضيف تجريبي" },
                { type: "text", parameter_name: "2", text: "عريس تجريبي" },
                { type: "text", parameter_name: "3", text: "عروس تجريبية" },
                { type: "text", parameter_name: "4", text: "الليلة" },
                { type: "text", parameter_name: "5", text: "قاعة الاختبار" }
            ]
        }
    ]);
}

startDebug();
