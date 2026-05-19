/*
 * FINAL PROOF SUCCESS SCRIPT
 */
import fetch from 'node-fetch';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const phoneId = process.env.META_PHONE_NUMBER_ID;
const token = process.env.META_ACCESS_TOKEN;
const testNumber = '966503578789'; 

async function sendFinalProof() {
    console.log(`\n🚀 Launching FINAL PROOF to ${testNumber}...`);
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
                    parameters: [
                        {
                            type: "image",
                            image: { link: "https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/demo_card.png" }
                        }
                    ]
                },
                {
                    type: "body",
                    parameters: [
                        { type: "text", parameter_name: "guest_name", text: "ضيف لوني الغالي" },
                        { type: "text", parameter_name: "groom_name", text: "الفارس محمد" },
                        { type: "text", parameter_name: "bride_name", text: "الأميرة سارة" },
                        { type: "text", parameter_name: "event_date", text: "الجمعة المقبلة" },
                        { type: "text", parameter_name: "event_location", text: "قاعة لوني الكبرى" }
                    ]
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
    console.log(`\nFinal Result: ${JSON.stringify(data, null, 2)}`);

    if (data.messages) {
        console.log("\n✅ SUCCESS! The payload is correct.");
    } else {
        console.log("\n❌ FAILED. Meta still rejects it.");
    }
}

sendFinalProof();
