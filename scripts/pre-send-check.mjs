import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const eventId = '69b19f4a-39a1-4921-86eb-8a5ade574fc2';
const ahmadId = 'd076e24d-82aa-42a2-8975-cef6959db1c9';
const sarahId = '1500e47b-a455-482c-9084-79528367fc38';

const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();

console.log('=== بيانات الحدث ===');
console.log('اسم العريس:', event.groom_name || '❌ فارغ');
console.log('اسم العروس:', event.bride_name || '❌ فارغ');
console.log('التاريخ:', event.date || '❌ فارغ');
console.log('الوقت:', event.event_time || event.settings?.event_time || '❌ فارغ');
console.log('الموقع:', event.location || '❌ فارغ');
console.log('القاعة:', event.venue || '❌ فارغ');
console.log('رابط الخريطة:', event.location_maps_url || '❌ فارغ');
console.log('صورة الدعوة العامة:', event.settings?.global_invite_image_url || '❌ فارغ');
console.log('القالب:', event.template_name);
console.log('');

const { data: guests } = await supabase
  .from('guests')
  .select('name, phone, card_image_url, status, rsvp_status')
  .in('id', [ahmadId, sarahId]);

console.log('=== بيانات الضيوف ===');
for (const g of guests) {
  const cardStatus = g.card_image_url ? '✅ موجود' : '❌ غير موجود';
  console.log(`${g.name}: جوال=${g.phone || '❌'}, كرت=${cardStatus}, حالة=${g.status}, rsvp=${g.rsvp_status}`);
}
