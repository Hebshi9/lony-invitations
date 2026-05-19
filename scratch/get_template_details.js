/*
 * FETCH TEMPLATE DETAILS FROM META (CLEAN VERSION)
 */
import fetch from 'node-fetch';
import 'dotenv/config';

const wabaId = process.env.META_WABA_ID;
const accessToken = process.env.META_ACCESS_TOKEN;

async function fetchTemplate() {
    const url = `https://graph.facebook.com/v18.0/${wabaId}/message_templates?name=lony`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });
    const data = await res.json();
    
    if (data.data && data.data[0]) {
        console.log("\n--- LONY TEMPLATE COMPONENTS ---");
        data.data[0].components.forEach(c => {
            console.log(`\nComponent Type: ${c.type}`);
            if (c.text) console.log(`Text: ${c.text}`);
            if (c.example) console.log(`Example: ${JSON.stringify(c.example)}`);
        });
    } else {
        console.log("Template 'lony' not found!");
    }
}

fetchTemplate();
