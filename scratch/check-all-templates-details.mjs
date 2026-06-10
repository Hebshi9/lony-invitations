import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function getTemplateDetails() {
    const wabaId = process.env.META_WABA_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const templates = ['get_update', 'lony_invite_bridge'];

    for (const tName of templates) {
        const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=${tName}`;
        console.log(`\n🔍 Fetching details for template: ${tName}...`);
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const data = await res.json();
            if (data.data && data.data.length > 0) {
                const t = data.data[0];
                console.log(`Name: ${t.name} | Status: ${t.status}`);
                t.components.forEach(c => {
                    console.log(`  - Type: ${c.type}`);
                    if (c.text) console.log(`    Text: ${c.text}`);
                    if (c.format) console.log(`    Format: ${c.format}`);
                    if (c.buttons) console.log(`    Buttons: ${JSON.stringify(c.buttons)}`);
                });
            } else {
                console.log(`No details found or error for ${tName}:`, JSON.stringify(data, null, 2));
            }
        } catch (e) {
            console.error(`Error for ${tName}:`, e.message);
        }
    }
}

getTemplateDetails();
