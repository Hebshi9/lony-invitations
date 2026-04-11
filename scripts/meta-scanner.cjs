const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });

const TOKEN = process.env.META_ACCESS_TOKEN;

async function scanAndSend() {
    console.log('🕵️ Listing All WABAs and Phone IDs...');
    const target = '966503678789';

    try {
        // 1. Get WABAs
        const wabaRes = await fetch(`https://graph.facebook.com/v21.0/me/whatsapp_business_accounts`, {
            headers: { 'Authorization': `Bearer ${TOKEN}` }
        });
        const wabaData = await wabaRes.json();

        if (!wabaData.data) {
            console.error('❌ No WABAs found or permission error:', wabaData);
            return;
        }

        for (const waba of wabaData.data) {
            console.log(`\n📦 Checking WABA: ${waba.name} (ID: ${waba.id})`);
            
            // 2. Get Phone Numbers for this WABA
            const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${waba.id}/phone_numbers`, {
                headers: { 'Authorization': `Bearer ${TOKEN}` }
            });
            const phoneData = await phoneRes.json();

            if (phoneData.data) {
                for (const phone of phoneData.data) {
                    console.log(`📡 Attempting to send from Phone: ${phone.display_phone_number} (ID: ${phone.id}) | Status: ${phone.status}`);
                    
                    // 3. Try to send a simple text
                    const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phone.id}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messaging_product: 'whatsapp',
                            to: target,
                            type: 'text',
                            text: { body: `Lony Scan Test: This is from Phone ID ${phone.id} (${phone.display_phone_number})` }
                        })
                    });
                    const sendData = await sendRes.json();
                    if (sendData.messages) {
                        console.log(`   ✅ API ACCEPTED from this ID! (MsgID: ${sendData.messages[0].id})`);
                    } else {
                        console.log(`   ❌ API REJECTED: ${sendData.error?.message}`);
                    }
                }
            }
        }

    } catch (e) {
        console.error('Scan Error:', e.message);
    }
}

scanAndSend();
