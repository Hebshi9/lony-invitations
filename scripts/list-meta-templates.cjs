require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const WABA_ID = process.env.META_WABA_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;

async function listTemplates() {
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        console.log('--- AVAILABLE TEMPLATES ---');
        data.data?.forEach(t => {
            console.log(`Name: ${t.name} | Status: ${t.status} | Lang: ${t.language}`);
        });
    } catch (e) {
        console.error('Error fetching templates:', e.message);
    }
}

listTemplates();
