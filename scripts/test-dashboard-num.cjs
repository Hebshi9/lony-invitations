const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;

async function testDashboardNumber() {
    console.log('🚀 Testing Dashboard Registered Number: 966507837584');
    const to = '966507837584'; // The number from the screenshot
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
                        parameters: [{ type: 'image', image: { link: sampleImage } }]
                    },
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', parameter_name: 'guest_name', text: 'صاحب النظام' },
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
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testDashboardNumber();
