import 'dotenv/config';

const WABA_ID = '3277627339072448';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

async function submitTemplate() {
  console.log('🚀 SUBMITTING lony_utility_v2 TO META...');
  
  const templateData = {
    name: 'lony_utility_v2',
    category: 'UTILITY',
    language: 'ar',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        example: {
          header_handle: ['892497657146283'] // Using the real Media ID we just verified
        }
      },
      {
        type: 'BODY',
        text: 'مرحباً {{1}}،\n\nتنبيه: تم إصدار بطاقة الدخول الرقمية الخاصة بك لحفل {{2}} و {{3}}.\n\n🗓️ التاريخ: {{4}}\n📍 الموقع: {{5}}\n\nيرجى تأكيد استلام البطاقة لاستكمال الحجز والتنظيم.',
        example: {
          body_text: [['الضيف الكريم', 'خالد', 'رغد', '2026-04-18', 'فندق بيوت مكين']]
        }
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'تأكيد الحضور'
          },
          {
            type: 'QUICK_REPLY',
            text: 'اعتذار عن الحضور'
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/message_templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });

    const result = await res.json();
    if (res.ok) {
      console.log('✅ TEMPLATE SUBMITTED SUCCESSFULLY!');
      console.log('ID:', result.id);
      console.log('STATUS: PENDING_REVIEW');
    } else {
      console.error('❌ SUBMISSION FAILED:', JSON.stringify(result, null, 2));
    }
  } catch (err) {
    console.error('❌ CRITICAL ERROR:', err.message);
  }
}

submitTemplate();
