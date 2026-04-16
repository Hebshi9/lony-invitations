require('dotenv').config();

async function getWaba() {
  const phone_id = process.env.META_PHONE_NUMBER_ID;
  const access_token = process.env.META_ACCESS_TOKEN;

  console.log('🔍 Auditing Meta Phone ID:', phone_id);
  
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phone_id}?fields=whatsapp_business_account`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });
    const data = await res.json();
    
    if (data.whatsapp_business_account) {
      console.log('✅ WABA_ID_FOUND=' + data.whatsapp_business_account.id);
    } else {
      console.log('❌ No WABA linked to this Phone ID. Details:', JSON.stringify(data));
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }
}

getWaba();
