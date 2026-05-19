import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function sendTemplateImageNamed() {
    const phone = '966503678789';
    const imageUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/qr-sample.png';
    const url = `https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

    console.log(`🚀 Sending template (get_update) with NAMED PARAMS + IMAGE to ${phone}...`);

    const payload = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
            name: "get_update",
            language: { code: "ar" },
            components: [
                { type: "header", parameters: [{ type: "image", image: { link: imageUrl } }] },
                { type: "body", parameters: [
                    { type: "text", parameter_name: "guest_name", text: "احمد" },
                    { type: "text", parameter_name: "groom_name", text: "الاحتفال" },
                    { type: "text", parameter_name: "bride_name", text: "قريباً" },
                    { type: "text", parameter_name: "event_date", text: "اليوم" },
                    { type: "text", parameter_name: "event_location", text: "تجربه ارسال" }
                ]},
                { type: "button", sub_type: "url", index: 2, parameters: [{ type: "text", text: "21.5433,39.1728" }] }
            ]
        }
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

sendTemplateImageNamed();
