
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function checkMetaLimits() {
  const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  const PHONE_ID = process.env.META_PHONE_NUMBER_ID;

  if (!META_ACCESS_TOKEN || !PHONE_ID) {
    console.error('❌ Error: Missing Meta credentials in .env');
    return;
  }

  try {
    console.log(`[Meta Audit] 🔎 Checking limits for ID: ${PHONE_ID}...`);
    
    // We query the phone number ID for various quality fields
    const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=messaging_limit_tier,quality_rating,status`, {
      headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
    });

    const data = await res.json();

    if (data.error) {
      console.error('❌ Meta Error:', data.error.message);
      return;
    }

    console.log('\n--- Meta Cloud API Status ---');
    console.log(`📡 Status: ${data.status}`);
    console.log(`🏆 Quality: ${data.quality_rating}`);
    console.log(`📊 Messaging Tier: ${data.messaging_limit_tier}`);
    
    const tierMap = {
      'TIER_1000': '1,000 رسالة / 24 ساعة',
      'TIER_10K': '10,000 رسالة / 24 ساعة',
      'TIER_100K': '100,000 رسالة / 24 ساعة',
      'TIER_UNLIMITED': 'غير محدود'
    };

    const limit = tierMap[data.messaging_limit_tier] || data.messaging_limit_tier;
    console.log(`✅ Current Daily Limit: ${limit}`);
    console.log('-----------------------------\n');

  } catch (err) {
    console.error('❌ Request failed:', err.message);
  }
}

checkMetaLimits();
