import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const https = require('https');
import { config } from 'dotenv';
config();

const TOKEN    = process.env.META_ACCESS_TOKEN;
const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const TO       = '966503678789'; // رقمك

function send(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const opts = {
      hostname: 'graph.facebook.com',
      path: `/v21.0/${PHONE_ID}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

console.log('🚀 إرسال التيمبلت المعتمد: lony_invite...\n');

const r = await send({
  messaging_product: 'whatsapp',
  to: TO,
  type: 'template',
  template: {
    name: 'lony_invite',
    language: { code: 'ar' },
    components: [
      // 1. صورة الهيدر
      {
        type: 'header',
        parameters: [{
          type: 'image',
          image: { link: 'https://lonyinvit.netlify.app/test-cards/general.jpg' } // صورة تجريبية
        }]
      },
      // 2. متغيرات الـ Body (الـ 5 اللي طلبهم التيمبلت)
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'ضيفنا الغالي' },      // {{guest_name}}
          { type: 'text', text: 'خالد بن محمد' },      // {{groom_name}}
          { type: 'text', text: 'سارة بنت أحمد' },     // {{bride_name}}
          { type: 'text', text: 'الجمعة 10 شوال' },    // {{event_date}}
          { type: 'text', text: 'قاعة الأساطير' }       // {{event_location}}
        ]
      }
    ]
  }
});

console.log('Status:', r.status);
console.log(JSON.stringify(r.body, null, 2));

if (r.body?.messages?.[0]?.id) {
  console.log('\n✅ وصلت الرسالة! شيك على جوالك الآن 🎉');
} else if (r.body?.error) {
  console.log('\n❌ فشل الإرسال:', r.body.error.message);
}
