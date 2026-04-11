const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = '1031606736708015';
const TOKEN = process.env.META_ACCESS_TOKEN;

async function testClassic() {
    console.log('🚀 Sending Template: lony using POSITIONAL parameters...');
    const to = '966503678789';
    const sampleImage = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/sample_invite.jpg';

    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: to,
            type: 'template',
            template: {
                name: 'lony',
                language: { code: 'ar' },
                components: [
                    {
                        type: 'header',
                        parameters: [
                            { type: 'image', image: { link: sampleImage } }
                        ]
                    },
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: 'ضيفنا العزيز' }, // {{1}}
                            { type: 'text', text: 'مشاري' },      // {{2}}
                            { type: 'text', text: 'رهف' },        // {{3}}
                            { type: 'text', text: '2026-05-20' }, // {{4}}
                            { type: 'text', text: 'الرياض' }      // {{5}}
                        ]
                    }
                ]
            }
        };

        const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Final Result:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testClassic();
