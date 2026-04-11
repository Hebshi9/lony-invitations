const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const TOKEN = process.env.META_ACCESS_TOKEN;
const WABA_ID = process.env.META_WABA_ID;

async function subscribeAndFix() {
    console.log('🔗 Attempting to Subscribe App to WABA...');
    try {
        // 1. Subscribe App to WABA (Crucial step for delivery)
        const subRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/subscribed_apps`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const subData = await subRes.json();
        console.log('Subscription Result:', JSON.stringify(subData, null, 2));

        if (subData.success) {
            console.log('✅ App successfully subscribed to WABA!');
            
            // 2. Try sending one more time with 966 formatting
            console.log('🚀 Sending final verification message to 0503678789...');
            const sendRes = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: '966503678789',
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
                                    { type: 'text', parameter_name: 'guest_name', text: 'صديق لوني' },
                                    { type: 'text', parameter_name: 'groom_name', text: 'مشاري' },
                                    { type: 'text', parameter_name: 'bride_name', text: 'رهف' },
                                    { type: 'text', parameter_name: 'event_date', text: '2026-05-20' },
                                    { type: 'text', parameter_name: 'event_location', text: 'الرياض' }
                                ]
                            }
                        ]
                    }
                })
            });
            const sendData = await sendRes.json();
            console.log('Send Result:', JSON.stringify(sendData, null, 2));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

subscribeAndFix();
