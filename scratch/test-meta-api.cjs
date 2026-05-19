
const fetch = require('node-fetch');
require('dotenv').config();

async function testMeta() {
    const phone = '966503678789'; // Using admin phone from .env
    const templateName = 'lony';
    const headerImage = 'https://lonyinvite.netlify.app/card-placeholder.png';
    const groomName = 'Test Groom';
    const brideName = 'Test Bride';
    const eventDate = 'Today';
    const eventLocation = 'Test Location';

    const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
            name: templateName,
            language: { code: 'ar' },
            components: [
                { type: 'header', parameters: [{ type: 'image', image: { link: headerImage } }] },
                {
                    type: 'body', parameters: [
                        { type: 'text', parameter_name: 'guest_name', text: 'Test Guest' },
                        { type: 'text', parameter_name: 'groom_name', text: groomName },
                        { type: 'text', parameter_name: 'bride_name', text: brideName },
                        { type: 'text', parameter_name: 'event_date', text: eventDate },
                        { type: 'text', parameter_name: 'event_location', text: eventLocation }
                    ]
                }
            ]
        }
    };

    console.log('Sending payload to Meta...');
    console.log('Phone ID:', process.env.META_PHONE_NUMBER_ID);
    
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('Response Status:', res.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch Error:', err.message);
    }
}

testMeta();
