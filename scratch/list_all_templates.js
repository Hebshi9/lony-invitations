/*
 * LIST ALL TEMPLATES FROM META
 */
import fetch from 'node-fetch';
import 'dotenv/config';

const wabaId = process.env.META_WABA_ID;
const accessToken = process.env.META_ACCESS_TOKEN;

async function listTemplates() {
    console.log(`\n🔍 Fetching ALL templates for WABA: ${wabaId}...`);
    const url = `https://graph.facebook.com/v18.0/${wabaId}/message_templates?limit=100`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const data = await res.json();
    
    if (data.data) {
        console.log(`\n--- TEMPLATES FOUND (${data.data.length}) ---`);
        data.data.forEach(t => {
            const body = t.components.find(c => c.type === 'BODY');
            const hasHeader = t.components.some(c => c.type === 'HEADER');
            const varCount = (body?.text?.match(/{{.*?}}/g) || []).length;
            console.log(`📌 [${t.name}] Status: ${t.status} | Vars: ${varCount} | Header: ${hasHeader ? '✅' : '❌'}`);
            if (varCount > 2) {
                console.log(`   Text: ${body.text}`);
            }
        });
    } else {
        console.log("No templates found or error occurred!");
        console.log(JSON.stringify(data));
    }
}

listTemplates();
