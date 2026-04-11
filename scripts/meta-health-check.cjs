const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const PHONE_ID = '1031606736708015';
const TOKEN = process.env.META_ACCESS_TOKEN;

async function checkHealth() {
    console.log('🔍 Checking Meta Account Health...');
    try {
        // 1. Check Phone Status
        console.log('\n--- Checking Phone Number Status ---');
        const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=id,display_phone_number,status,quality_rating,name_status`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const phoneData = await phoneRes.json();
        console.log('Phone Health:', JSON.stringify(phoneData, null, 2));

        // 2. Check Messaging Limits
        console.log('\n--- Checking Messaging Limits ---');
        const limitRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messaging_limit`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const limitData = await limitRes.json();
        console.log('Messaging Limits:', JSON.stringify(limitData, null, 2));

        if (phoneData.status === 'CONNECTED' && phoneData.name_status === 'APPROVED') {
            console.log('\n✅ ACCOUNT IS FULLY ACTIVE AND APPROVED.');
        } else {
            console.log('\n⚠️ ACCOUNT HAS ISSUES. PLEASE REVIEW ABOVE LOGS.');
        }

    } catch (e) {
        console.error('Check Error:', e.message);
    }
}

checkHealth();
