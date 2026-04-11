const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const TOKEN = process.env.META_ACCESS_TOKEN;

async function probeMeta() {
    console.log('🔍 Probing Meta for available Phone IDs...');
    try {
        // 1. Get WABAs connected to this token
        console.log('--- Step 1: Fetching WABA Accounts ---');
        const res1 = await fetch(`https://graph.facebook.com/v21.0/me/whatsapp_business_accounts`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const wabaData = await res1.json();
        console.log('WABAs:', JSON.stringify(wabaData, null, 2));

        if (wabaData.data && wabaData.data.length > 0) {
            for (const waba of wabaData.data) {
                console.log(`\n--- Step 2: Fetching Phone Numbers for WABA: ${waba.name} (${waba.id}) ---`);
                const res2 = await fetch(`https://graph.facebook.com/v21.0/${waba.id}/phone_numbers`, {
                    headers: { 'Authorization': `Bearer ${TOKEN}` }
                });
                const phoneData = await res2.json();
                console.log('Phones:', JSON.stringify(phoneData, null, 2));
            }
        } else {
            console.log('❌ No WABAs found for this token.');
        }

    } catch (e) {
        console.error('Probe Error:', e.message);
    }
}

probeMeta();
