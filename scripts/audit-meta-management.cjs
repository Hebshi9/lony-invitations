
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function auditMetaManagement() {
  const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  const PHONE_ID = process.env.META_PHONE_NUMBER_ID;

  try {
    console.log(`[Meta Audit] Fetching WABA ID for Phone: ${PHONE_ID}...`);
    const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=whatsapp_business_account`, {
      headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
    });
    const data = await res.json();
    
    if (data.error) {
       console.error('❌ Error fetching WABA ID:', data.error.message);
       return;
    }

    const wabaId = data.whatsapp_business_account.id;
    console.log(`✅ Found WABA ID: ${wabaId}`);

    console.log(`[Meta Audit] Listing existing templates...`);
    const tplRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates`, {
      headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
    });
    const tplData = await tplRes.json();
    
    if (tplData.error) {
       console.error('❌ Error listing templates:', tplData.error.message);
       return;
    }

    console.log(`✅ Found ${tplData.data.length} templates.`);
    tplData.data.forEach(t => console.log(` - ${t.name} [${t.category}] (${t.status})`));

  } catch (err) {
    console.error('❌ Request failed:', err.message);
  }
}

auditMetaManagement();
