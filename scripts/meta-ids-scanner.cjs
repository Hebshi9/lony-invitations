const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const TOKEN = process.env.META_ACCESS_TOKEN;
const BUSINESS_ID = '2269148464248688';

async function scanBusinessAssets() {
    console.log(`🕵️ Scanning Meta Business Assets for ID: ${BUSINESS_ID}...`);
    try {
        // 1. Get WABAs connected to the business
        const res1 = await fetch(`https://graph.facebook.com/v21.0/${BUSINESS_ID}/owned_whatsapp_business_accounts`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const wabaData = await res1.json();
        
        if (wabaData.error) {
            console.error('❌ Meta API Error (WABA Fetch):', wabaData.error.message);
            return;
        }

        console.log(`✅ Found ${wabaData.data.length} WhatsApp Business Accounts.`);

        for (const waba of wabaData.data) {
            console.log(`\n📦 WABA: ${waba.name} (ID: ${waba.id})`);
            
            // 2. Get Phone Numbers for this WABA
            const res2 = await fetch(`https://graph.facebook.com/v21.0/${waba.id}/phone_numbers`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            const phoneData = await res2.json();
            
            if (phoneData.data) {
                console.log(`   Found ${phoneData.data.length} Phone IDs:`);
                phoneData.data.forEach(p => {
                    console.log(`   - Number: ${p.display_phone_number} | ID: ${p.id} | Status: ${p.status}`);
                });
            } else {
                console.log('   No Phone IDs found for this WABA.');
            }
        }

    } catch (e) {
        console.error('Scan Error:', e.message);
    }
}

scanBusinessAssets();
