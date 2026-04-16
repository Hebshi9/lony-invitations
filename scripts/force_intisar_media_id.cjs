require('dotenv').config();
const FormData = require('form-data');
const fetch = require('node-fetch');

async function uploadAndSendToIntisar() {
  console.log('🚀 PHASE 1: UPLOADING IMAGE TO META SERVERS (MEDIA ID)...');
  
  const phone_id = process.env.META_PHONE_NUMBER_ID;
  const access_token = process.env.META_ACCESS_TOKEN;
  const image_url = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/wedding_invite.jpg';
  
  try {
    // 1. Download image to temp buffer
    const imageRes = await fetch(image_url);
    const buffer = await imageRes.buffer();

    // 2. Prepare FormData for Meta using form-data package
    const form = new FormData();
    form.append('file', buffer, {
        filename: 'invite.jpg',
        contentType: 'image/jpeg'
    });
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/jpeg');

    // 3. Upload to Meta
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${phone_id}/media`, {
      method: 'POST',
      headers: { 
          'Authorization': `Bearer ${access_token}`,
          ...form.getHeaders()
      },
      body: form
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      console.error('❌ FAILED TO UPLOAD TO META:', JSON.stringify(uploadData));
      return;
    }

    const mediaId = uploadData.id;
    console.log(`✅ IMAGE PINNED TO META! Media ID: ${mediaId}`);

    // 4. Send using Media ID to Intisar
    console.log('\n🚀 PHASE 2: SENDING TO INTISAR USING MEDIA ID (THE BYPASS)...');
    const payload = {
      messaging_product: 'whatsapp',
      to: '966535520888',
      type: 'template',
      template: {
        name: 'lony',
        language: { code: 'ar' },
        components: [
          {
            type: 'header',
            parameters: [{ type: 'image', image: { id: mediaId } }]
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', parameter_name: 'guest_name', text: 'انتصار' },
              { type: 'text', parameter_name: 'groom_name', text: 'خالد' },
              { type: 'text', parameter_name: 'bride_name', text: 'رغد' },
              { type: 'text', parameter_name: 'event_date', text: '2026-04-18' },
              { type: 'text', parameter_name: 'event_location', text: 'فندق بيوت مكين قاعة الاوركيد' }
            ]
          }
        ]
      }
    };

    const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phone_id}/messages`, {
      method: 'POST',
      headers: { 
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const sendData = await sendRes.json();
    if (sendRes.ok) {
      console.log(`✅ SUCCESS! Message sent to Intisar with Media ID bypass.`);
      console.log(`WAMID: ${sendData.messages[0].id}`);
      console.log('⏳ POLL YOUR BLACK BOX (webhook_debug_logs) IN 10 SECONDS...');
    } else {
      console.error('❌ FAILED TO SEND:', JSON.stringify(sendData));
    }
  } catch (err) {
    console.error('❌ CRITICAL ERROR:', err.message);
  }
}

uploadAndSendToIntisar();
