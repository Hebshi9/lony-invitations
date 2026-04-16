import 'dotenv/config';

async function run() {
  console.log('🚀 META DIRECT INJECTION (NATIVE V22): Starting Intisar Recovery...');
  
  const phone_id = process.env.META_PHONE_NUMBER_ID;
  const access_token = process.env.META_ACCESS_TOKEN;
  const INTISAR_PHONE = '966535520888';

  try {
    // 1. Download image
    const image_url = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/wedding_invite.jpg';
    const imageRes = await fetch(image_url);
    const arrayBuffer = await imageRes.arrayBuffer();
    
    // 2. Create native File object (Node 22)
    const file = new File([arrayBuffer], 'invite.jpg', { type: 'image/jpeg' });

    // 3. Prepare Native FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', 'image/jpeg');

    console.log('➡️ Uploading to Meta Media Storage (Native Push)...');
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${phone_id}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access_token}` },
      body: formData
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error('Meta Upload Failed: ' + JSON.stringify(uploadData));

    const mediaId = uploadData.id;
    console.log(`✅ Media Uploaded! ID: ${mediaId}`);

    // 4. Send Message
    console.log(`➡️ Sending Invitation to Intisar (${INTISAR_PHONE})...`);
    const payload = {
      messaging_product: 'whatsapp',
      to: INTISAR_PHONE,
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
      console.log('🔥 MISSION SUCCESS! Invitation landlocked on Intisar.');
      console.log('WAMID:', sendData.messages[0].id);
      console.log('⏳ CHECKING DATABASE FOR DELIVERY STATUS...');
    } else {
      console.error('❌ Send Failed:', JSON.stringify(sendData));
    }
  } catch (err) {
    console.error('❌ ERROR:', err.message);
  }
}

run();
