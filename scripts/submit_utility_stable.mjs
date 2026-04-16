import 'dotenv/config';
import fs from 'fs';

const WABA_ID = '3277627339072448';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const IMAGE_PATH = 'scripts/temp_invite.jpg';

async function uploadToAssetsAndSubmit() {
  console.log('🚀 STEP 1: INITIALIZING META CONTENT UPLOAD...');
  
  try {
    // 0. Ensure file exists
    if (!fs.existsSync(IMAGE_PATH)) {
      console.log('Downloading image first...');
      const imgRes = await fetch('https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/wedding_invite.jpg');
      const buffer = await imgRes.arrayBuffer();
      fs.writeFileSync(IMAGE_PATH, Buffer.from(arrayBuffer));
    }

    const fileStats = fs.statSync(IMAGE_PATH);
    const fileSize = fileStats.size;

    // 1. Create session (Try WABA ID instead of Phone ID)
    const createRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/uploads?file_length=${fileSize}&file_type=image/jpeg`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    const sessionData = await createRes.json();
    if (!createRes.ok) throw new Error('Session Init Failed: ' + JSON.stringify(sessionData));
    
    const sessionId = sessionData.id;
    console.log(`✅ Session Created: ${sessionId}`);

    // 2. Upload Binary
    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${sessionId}`, {
      method: 'POST',
      headers: { 
        'Authorization': `OAuth ${ACCESS_TOKEN}`,
        'file_offset': '0'
      },
      body: fileBuffer
    });
    const uploadResult = await uploadRes.json();
    if (!uploadRes.ok) throw new Error('Asset Upload Failed: ' + JSON.stringify(uploadResult));

    const handle = uploadResult.h;
    console.log(`✅ Asset Pinned! Handle: ${handle}`);

    // 3. Submit Template
    console.log('\n🚀 STEP 2: SUBMITTING lony_utility_v2 WITH OFFICIAL HANDLE...');
    const templateData = {
      name: 'lony_utility_v2',
      category: 'UTILITY',
      language: 'ar',
      components: [
        {
          type: 'HEADER',
          format: 'IMAGE',
          example: { header_handle: [handle] }
        },
        {
          type: 'BODY',
          text: 'مرحباً {{1}}،\n\nتنبيه: تم إصدار بطاقة الدخول الرقمية الخاصة بك لحفل {{2}} و {{3}}.\n\n🗓️ التاريخ: {{4}}\n📍 الموقع: {{5}}\n\nيرجى تأكيد استلام البطاقة لاستكمال الحجز والتنظيم.',
          example: { body_text: [['الضيف الكريم', 'خالد', 'رغد', '2026-04-18', 'قاعة الاوركيد']] }
        },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'تأكيد الحضور' },
            { type: 'QUICK_REPLY', text: 'اعتذار عن الحضور' }
          ]
        }
      ]
    };

    const submitRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(templateData)
    });

    const finalResult = await submitRes.json();
    if (submitRes.ok) {
        console.log('🔥 MISSION SUCCESS! Template is now for Review.');
        console.log('ID:', finalResult.id);
    } else {
        console.error('❌ SUBMISSION FAILED:', JSON.stringify(finalResult, null, 2));
    }

  } catch (err) {
    console.error('❌ CRITICAL ERROR:', err.message);
  }
}

uploadToAssetsAndSubmit();
