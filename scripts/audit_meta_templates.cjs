require('dotenv').config();
const fetch = require('node-fetch');

async function getMetaDetails() {
  const phone_id = process.env.META_PHONE_NUMBER_ID;
  const access_token = process.env.META_ACCESS_TOKEN;
  const wabaId = '3277627339072448'; // Verified from .env

  try {
    console.log(`🔍 Fetching current "lony" template structure from WABA: ${wabaId}...`);
    const templatesRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?name=lony`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const templatesData = await templatesRes.json();
    
    if (templatesData.data && templatesData.data.length > 0) {
      console.log('✅ Template Found!');
      console.log('RESULTS:', JSON.stringify(templatesData.data[0], null, 2));
    } else {
      console.log('❌ Template "lony" not found or error occurred.');
      console.log('FULL_RES:', JSON.stringify(templatesData, null, 2));
    }

  } catch (err) {
    console.error('❌ Error during Meta audit:', err.message);
  }
}

getMetaDetails();
