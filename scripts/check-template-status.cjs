const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const TOKEN = process.env.META_ACCESS_TOKEN;
const WABA_ID = process.env.META_WABA_ID;

async function checkTemplates() {
    console.log(`📋 Checking Template status for WABA: ${WABA_ID}...`);
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=lony`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const data = await res.json();
        
        if (data.data && data.data.length > 0) {
            const template = data.data[0];
            console.log(`Template Name: ${template.name}`);
            console.log(`Status: ${template.status}`);
            console.log(`Category: ${template.category}`);
            console.log(`Language: ${template.language}`);
            
            if (template.status !== 'APPROVED') {
                console.error(`⚠️ Template is NOT approved. Current status: ${template.status}`);
            } else {
                console.log(`✅ Template is APPROVED and ready.`);
            }
        } else {
            console.error('❌ Template "lony" not found in this WABA.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

checkTemplates();
