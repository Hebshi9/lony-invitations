
import { createClient } from '@supabase/supabase-api';
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export const handler = async (event) => {
  const { imageUrl, eventId } = JSON.parse(event.body);
  const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
  const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

  if (!imageUrl || !META_ACCESS_TOKEN) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing parameters' }) };
  }

  try {
    console.log(`[Meta Media] 📁 Uploading ${imageUrl} to Meta...`);

    // 1. Fetch the image
    const imgRes = await fetch(imageUrl);
    const blob = await imgRes.blob();
    const formData = new URLSearchParams();
    
    // Meta requires a form data upload for media
    // However, Meta Cloud API for MEDIA upload is a bit different.
    // It usually requires a POST to /phone-id/media with binary data.
    
    // For simplicity and high success, we'll use a multipart form data approach
    const { default: FormData } = await import('form-data');
    const form = new FormData();
    form.append('file', blob.stream(), { filename: 'invite.jpg', contentType: blob.type });
    form.append('messaging_product', 'whatsapp');

    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        ...form.getHeaders()
      },
      body: form
    });

    const metaData = await metaRes.json();
    console.log('[Meta Media] 🟢 Meta Response:', metaData);

    if (metaData.id) {
      // Store in DB if eventId provided
      if (eventId) {
         const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
         await supabase.from('events').update({ meta_media_id: metaData.id }).eq('id', eventId);
      }
      return { statusCode: 200, body: JSON.stringify({ success: true, mediaId: metaData.id }) };
    }

    return { statusCode: 500, body: JSON.stringify({ error: metaData.error?.message || 'Upload failed' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
