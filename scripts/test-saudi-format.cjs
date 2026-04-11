const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;

async function testSaudiFormatting() {
    const rawNumber = '0503678789';
    console.log(`🚀 Testing Saudi Auto-Formatting for: ${rawNumber}`);
    
    // Manual simulation of the code logic
    let phone = rawNumber.replace(/\D/g, '');
    if (phone.startsWith('05')) {
        phone = '966' + phone.substring(1);
    } else if (phone.startsWith('5') && phone.length === 9) {
        phone = '966' + phone;
    }
    
    console.log(`Formatted Number for Meta: ${phone}`);

    const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
            name: 'lony',
            language: { code: 'ar' },
            components: [
                {
                    type: 'header',
                    parameters: [{ type: 'image', image: { link: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/sample_invite.jpg' } }]
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

    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log('API Result:', JSON.stringify(data, null, 2));

        if (data.messages) {
            console.log('✅ TEST PASSED: Meta accepted the correctly formatted number.');
        } else {
            console.error('❌ TEST FAILED:', data.error?.message);
        }
    } catch (e) {
        console.error('Network Error:', e.message);
    }
}

testSaudiFormatting();
