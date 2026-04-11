const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = '1031606736708015';
const TOKEN = process.env.META_ACCESS_TOKEN;

async function checkPhoneStatus() {
    console.log(`🔍 Checking Status for Phone ID: ${PHONE_ID}...`);
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=id,display_phone_number,status,quality_rating`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        console.log('Phone Status Data:', JSON.stringify(data, null, 2));

        if (data.error) {
            console.log('❌ TOKEN PERMISSION ERROR: This token cannot access this phone ID.');
        } else {
            console.log('✅ TOKEN IS VALID FOR THIS PHONE. Status:', data.status);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkPhoneStatus();
