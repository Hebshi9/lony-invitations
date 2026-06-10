import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

async function checkLonyGeneric() {
    const wabaId = process.env.META_WABA_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=lony_generic`;
    
    console.log(`🔍 Fetching details for lony_generic from Meta WABA...`);
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error fetching template details:', e);
    }
}

checkLonyGeneric();
