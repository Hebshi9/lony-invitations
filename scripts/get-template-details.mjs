import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function getTemplateDetails() {
    const wabaId = process.env.META_WABA_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;

    console.log(`🔍 Fetching details for all templates...`);

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (data.data) {
            data.data.forEach(t => {
                console.log(`========================================`);
                console.log(`Template: ${t.name} (${t.language}) [Status: ${t.status}]`);
                console.log(`Category: ${t.category}`);
                t.components.forEach(c => {
                    if (c.type === 'BODY') {
                        console.log(`Body text: \n"${c.text}"`);
                    } else if (c.type === 'BUTTONS') {
                        console.log(`Buttons: ${JSON.stringify(c.buttons)}`);
                    } else if (c.type === 'HEADER') {
                        console.log(`Header format: ${c.format} ${c.text ? `("${c.text}")` : ''}`);
                    }
                });
                console.log(`========================================\n`);
            });
        } else {
            console.log('Error:', data);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

getTemplateDetails();
