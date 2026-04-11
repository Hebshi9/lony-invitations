const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const WABA_ID = process.env.META_WABA_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;

async function getTemplateDetails() {
    console.log(`🔍 Fetching template details for: lony (WABA: ${WABA_ID})...`);
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=lony`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        console.log('Template Data:', JSON.stringify(data, null, 2));

        if (data.data && data.data.length > 0) {
            const template = data.data[0];
            console.log('--- Template Structure ---');
            template.components.forEach(c => {
                console.log(`Type: ${c.type}`);
                if (c.text) console.log(`Text: ${c.text}`);
                if (c.example) console.log(`Example: ${JSON.stringify(c.example)}`);
            });
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

getTemplateDetails();
