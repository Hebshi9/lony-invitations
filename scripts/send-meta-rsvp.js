import 'dotenv/config';
import fetch from 'node-fetch';

const ACCESS_TOKEN    = process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const RECIPIENT_PHONE = (process.env.ADMIN_PHONE || '+966503678789').replace('+', '');

// ── Test Data (change as needed) ──────────────────────────────
const TEST_GUEST = {
    name:     'عبدالله',
    groom:    'محمد',
    bride:    'سارة',
    date:     '15-4-2026',
    location: 'قاعة لوني'
};

// Header image - use the same one from the approved template example
const HEADER_IMAGE_URL = 'https://scontent.whatsapp.net/v/t61.29466-34/534417572_2190220821748040_4017034750524845274_n.jpg?ccb=1-7&_nc_sid=8b1bef&_nc_ohc=08IlnEi5q94Q7kNvwH1YKKw&_nc_oc=AdoPQbnUh8CGtgmNi2a9_bOahNBB7cCZ5cLhwgFqoOwPZT5VD4o01W9XpLzKbgeo87xE99ALOgZeHWP9nHFxiQbA&_nc_zt=3&_nc_ht=scontent.whatsapp.net&edm=AH51TzQEAAAA&_nc_gid=AHVrNlrGq2BUE35NXpYDxQ&_nc_tpa=Q5bMBQHthuJ5HcnWFcx-2aWYj8BGmtiTDBycD1-V1LueTMlSBh_Fv6bMdClYpiKuiTulwV94yNzMen850g&oh=01_Q5Aa4QFLDjl30_L1JhDQ8dqKz5HL_NB1SQx7N6QHr_rjiFASlQ&oe=69FCB0FB';

async function sendInviteTemplate() {
    console.log('🚀 Sending lony_invite template...');
    console.log(`📱 To: +${RECIPIENT_PHONE}`);
    console.log(`👤 Guest: ${TEST_GUEST.name}\n`);

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

    const body = {
        messaging_product: "whatsapp",
        to: RECIPIENT_PHONE,
        type: "template",
        template: {
            name: "lony_invite",
            language: { code: "ar" },
            components: [
                // Header: image
                {
                    type: "header",
                    parameters: [
                        {
                            type: "image",
                            image: { link: HEADER_IMAGE_URL }
                        }
                    ]
                },
                // Body: 5 named variables
                {
                    type: "body",
                    parameters: [
                        { type: "text", parameter_name: "guest_name",     text: TEST_GUEST.name },
                        { type: "text", parameter_name: "groom_name",     text: TEST_GUEST.groom },
                        { type: "text", parameter_name: "bride_name",     text: TEST_GUEST.bride },
                        { type: "text", parameter_name: "event_date",     text: TEST_GUEST.date },
                        { type: "text", parameter_name: "event_location", text: TEST_GUEST.location }
                    ]
                },
                // Button 1: تأكيد الحضور
                {
                    type: "button",
                    sub_type: "quick_reply",
                    index: "0",
                    parameters: [{ type: "payload", payload: "btn_confirm" }]
                },
                // Button 2: اعتذار
                {
                    type: "button",
                    sub_type: "quick_reply",
                    index: "1",
                    parameters: [{ type: "payload", payload: "btn_decline" }]
                }
            ]
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.messages) {
        console.log('✅ SUCCESS! Template sent to your WhatsApp!');
        console.log('📨 Message ID:', data.messages[0].id);
        console.log('\n💡 Check your WhatsApp and press a button to test the webhook!');
    } else {
        console.error('❌ FAILED:', JSON.stringify(data.error, null, 2));
    }
}

sendInviteTemplate();
