import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const META_TOKEN = process.env.META_ACCESS_TOKEN || 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';
const PHONE_ID = process.env.META_PHONE_NUMBER_ID || '1031606736708015';

async function getTemplates() {
    console.log('🔍 Fetching WABA ID from phone number endpoint with fields parameter...');
    const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=whatsapp_business_account_id,verified_name,display_phone_number`, {
        headers: { 'Authorization': `Bearer ${META_TOKEN}` }
    });
    
    const phoneData = await phoneRes.json();
    console.log('Phone details:', JSON.stringify(phoneData, null, 2));
    
    const wabaId = phoneData.whatsapp_business_account_id;
    if (!wabaId) {
        console.error('WABA ID not found.');
        return;
    }
    
    console.log(`🔍 Fetching templates for WABA ID: ${wabaId}...`);
    const templatesRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100`, {
        headers: { 'Authorization': `Bearer ${META_TOKEN}` }
    });
    
    const templatesData = await templatesRes.json();
    if (templatesData.data) {
        console.log(`Found ${templatesData.data.length} templates:`);
        templatesData.data.forEach(t => {
            console.log(`- Name: ${t.name} | Status: ${t.status} | Category: ${t.category} | Language: ${t.language}`);
            if (t.name === 'get_update' || t.name === 'lony' || t.name === 'lony_invite_bridge') {
                console.log('  Components:', JSON.stringify(t.components, null, 2));
            }
        });
    } else {
        console.error('Failed to fetch templates:', templatesData);
    }
}

getTemplates();
