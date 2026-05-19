import dotenv from 'dotenv';
dotenv.config();

const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

const phone = '966503678789';

const payload = {
  messaging_product: 'whatsapp',
  to: phone,
  type: 'template',
  template: {
    name: 'get_update',
    language: { code: 'ar' },
    components: [
      {
        type: 'header',
        parameters: [{
          type: 'image',
          image: { link: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/0.7066818468191447.jpg' }
        }]
      },
      {
        type: 'body',
        parameters: [
          { type: 'text', parameter_name: 'guest_name', text: 'احمد' },
          { type: 'text', parameter_name: 'groom_name', text: 'مشاري' },
          { type: 'text', parameter_name: 'bride_name', text: 'رهف' },
          { type: 'text', parameter_name: 'event_date', text: '2026-05-07' },
          { type: 'text', parameter_name: 'event_location', text: 'قاعة الاحتفالات' }
        ]
      },
      { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
      { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
      { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: '24.6094%2C46.8152' }] }
    ]
  }
};

console.log('Sending with URL-encoded coords...');
const res = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
});

const data = await res.json();
console.log('Status:', res.status);
console.log('Response:', JSON.stringify(data, null, 2));
