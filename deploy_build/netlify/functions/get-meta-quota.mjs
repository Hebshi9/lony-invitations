
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export const handler = async (event) => {
  const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  const PHONE_ID = process.env.META_PHONE_NUMBER_ID;

  if (!META_ACCESS_TOKEN || !PHONE_ID) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Meta credentials not configured in environment' }) 
    };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=messaging_limit_tier,quality_rating,status`, {
      headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
    });

    const data = await res.json();

    if (data.error) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({
        status: data.status,
        quality: data.quality_rating,
        limit: data.messaging_limit_tier,
        timestamp: new Date().toISOString()
      }) 
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
