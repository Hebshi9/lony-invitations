import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function listTemplates() {
    const wabaId = process.env.META_WABA_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;

    console.log(`🔍 Fetching templates for WABA: ${wabaId}...`);

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        
        if (data.data) {
            console.log(`\n✅ Found ${data.data.length} templates:`);
            data.data.forEach(t => {
                console.log(`- Name: ${t.name} | Status: ${t.status} | Category: ${t.category}`);
            });
        } else {
            console.log('Error:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

listTemplates();
