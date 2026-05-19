import dotenv from 'dotenv';
dotenv.config();

const WABA_ID = '3277627339072448';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

console.log('Fetching template details from Meta...');

const res = await fetch(
  `https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?name=get_update`,
  {
    headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}` }
  }
);

const data = await res.json();
console.log('Status:', res.status);
console.log('Template:', JSON.stringify(data, null, 2));
