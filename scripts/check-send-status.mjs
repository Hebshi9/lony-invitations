import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const eventId = '69b19f4a-39a1-4921-86eb-8a5ade574fc2';

// Check recent messages for this event
const { data: msgs } = await supabase
  .from('whatsapp_messages')
  .select('*, guests(name)')
  .eq('event_id', eventId)
  .order('created_at', { ascending: false })
  .limit(10);

console.log('=== آخر الرسائل ===');
if (!msgs || msgs.length === 0) {
  console.log('❌ لا توجد أي رسائل مسجلة! السيرفر لم يسجل أي إرسال.');
} else {
  for (const m of msgs) {
    console.log(`${m.guests?.name}: status=${m.status}, phase=${m.message_phase}, created=${m.created_at}`);
  }
}

// Check webhook debug logs
const { data: logs } = await supabase
  .from('webhook_debug_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5);

console.log('\n=== آخر سجلات الأخطاء ===');
if (!logs || logs.length === 0) {
  console.log('لا توجد سجلات أخطاء حديثة.');
} else {
  for (const l of logs) {
    console.log(JSON.stringify(l.payload, null, 2));
  }
}

// Now manually test sending to Ahmad to see the exact error
console.log('\n=== اختبار إرسال يدوي لأحمد ===');
const ahmadId = 'd076e24d-82aa-42a2-8975-cef6959db1c9';
const res = await fetch('https://lonyinvite.netlify.app/api/send-campaign', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    guestIds: [ahmadId],
    eventId: eventId,
    campaignType: 'get_update'
  })
});
const data = await res.json();
console.log('Status:', res.status);
console.log('Result:', JSON.stringify(data, null, 2));
