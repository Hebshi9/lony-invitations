const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;

async function debugMeta() {
    console.log('🔍 Meta Direct Debug...');
    const numbers = ['966503678789', '+966503678789'];
    
    for (const to of numbers) {
        console.log(`\n--- Testing Number: ${to} ---`);
        try {
            // Test 1: Simple Text (Only works if user replied in last 24h, but good for testing connection)
            const res1 = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'text',
                    text: { body: 'Lony Test: ' + new Date().toLocaleTimeString() }
                })
            });
            const data1 = await res1.json();
            console.log('Simple Text Response:', JSON.stringify(data1, null, 2));

            // Test 2: Template 'lony' with absolute caution
            const res2 = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to: to,
                    type: 'template',
                    template: {
                        name: 'lony',
                        language: { code: 'ar' },
                        components: [
                           {
                             type: 'body',
                             parameters: [
                                { type: 'text', parameter_name: 'guest_name', text: 'تجربة' },
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
            const data2 = await res2.json();
            console.log('Template Response:', JSON.stringify(data2, null, 2));
            
        } catch (e) {
            console.error('Fetch Error:', e.message);
        }
    }
}

debugMeta();
