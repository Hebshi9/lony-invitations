const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = '1031606736708015';
const TOKEN = process.env.META_ACCESS_TOKEN;

async function ultimateDebugSend() {
    console.log('🚀 Executing Ultimate Debug Send...');
    const target = '966503678789';
    const sampleImage = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/sample_invite.jpg';

    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: target,
            type: 'template',
            template: {
                name: 'lony',
                language: { code: 'ar' },
                components: [
                    {
                        type: 'header',
                        parameters: [{ type: 'image', image: { link: sampleImage } }]
                    },
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', parameter_name: 'guest_name', text: 'ضيفنا اللوني' },
                            { type: 'text', parameter_name: 'groom_name', text: 'مشاري' },
                            { type: 'text', parameter_name: 'bride_name', text: 'رهف' },
                            { type: 'text', parameter_name: 'event_date', text: '2026-05-20' },
                            { type: 'text', parameter_name: 'event_location', text: 'الرياض' }
                        ]
                    }
                ]
            }
        };

        const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${TOKEN}`, 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('--- Full Payload Sent ---');
        console.log('--- Meta Server Response ---');
        console.log(JSON.stringify(data, null, 2));

        if (data.messages) {
            console.log('\n✅ MESSAGE ACCEPTED BY META!');
            console.log('Message ID:', data.messages[0].id);
            console.log('If this is NOT arriving, check "Activity Log" in WhatsApp Manager IMMEDIATELY.');
        } else {
            console.error('\n❌ META REJECTED REQUEST:', data.error?.message);
        }

    } catch (e) {
        console.error('Network Error:', e.message);
    }
}

ultimateDebugSend();
