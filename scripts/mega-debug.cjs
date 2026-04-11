const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;

async function megaDebug() {
    console.log('🧪 Starting Mega Debug (3 Variants)...');
    
    // Variant 1: Matching the Dashboard cURL (No 966)
    // Variant 2: Standard International
    const targets = ['503678789', '966503678789'];
    const images = [
        'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/sample_invite.jpg',
        'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800' // Neutral high-quality image
    ];

    for (const to of targets) {
        for (const img of images) {
            console.log(`\n--- Sending to [${to}] with Image: [${img.substring(0, 30)}...] ---`);
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
                                parameters: [{ type: 'image', image: { link: img } }]
                            },
                            {
                                type: 'body',
                                parameters: [
                                    { type: 'text', parameter_name: 'guest_name', text: 'ضيف التجربة' },
                                    { type: 'text', parameter_name: 'groom_name', text: 'مشاري' },
                                    { type: 'text', parameter_name: 'bride_name', text: 'رهف' },
                                    { type: 'text', parameter_name: 'event_date', text: '2026-05-20' },
                                    { type: 'text', parameter_name: 'event_location', text: 'الرياض' }
                                ]
                            }
                        ]
                    }
                };

                const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                console.log(`Result: ${data.messages ? '✅ SENT (ID: ' + data.messages[0].id + ')' : '❌ FAILED: ' + JSON.stringify(data)}`);
            } catch (e) {
                console.error('Error:', e.message);
            }
        }
    }
}

megaDebug();
