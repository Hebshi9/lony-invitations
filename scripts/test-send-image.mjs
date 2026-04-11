import dotenv from 'dotenv';
dotenv.config();

const TOKEN    = process.env.META_ACCESS_TOKEN;
const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const VERSION  = 'v21.0';

// ← رقمك (بدون + وبالصيغة الدولية)
const TO = '966503678789';

async function metaPost(payload) {
  const res = await fetch(
    `https://graph.facebook.com/${VERSION}/${PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log('📤 إرسال رسالة نصية تجريبية...\n');

  // 1. رسالة نصية
  const textRes = await metaPost({
    messaging_product: 'whatsapp',
    to: TO,
    type: 'text',
    text: { body: '✅ اختبار Lony Invitations - الرسايل تصل!' },
  });

  console.log(`نصية → Status: ${textRes.status}`);
  console.log(JSON.stringify(textRes.data, null, 2));

  // 2. صورة تجريبية (لوقو عام)
  console.log('\n📤 إرسال صورة تجريبية...\n');

  const imgRes = await metaPost({
    messaging_product: 'whatsapp',
    to: TO,
    type: 'image',
    image: {
      link: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/240px-PNG_transparency_demonstration_1.png',
      caption: '💐 هذي بطاقة دعوتك التجريبية - Lony Invitations',
    },
  });

  console.log(`صورة → Status: ${imgRes.status}`);
  console.log(JSON.stringify(imgRes.data, null, 2));

  // تحليل النتيجة
  console.log('\n=== 📊 النتيجة ===');
  if (textRes.data?.messages?.[0]?.id) {
    console.log('✅ الرسالة النصية أُرسلت بنجاح!');
  } else if (textRes.data?.error) {
    console.log('❌ خطأ:', textRes.data.error.message);
    console.log('   الكود:', textRes.data.error.code);
    if (textRes.data.error.code === 131030) {
      console.log('   ⚠️ الرقم غير مضاف كمستخدم تجريبي في لوحة Meta!');
    }
  }
}

run().catch(console.error);
