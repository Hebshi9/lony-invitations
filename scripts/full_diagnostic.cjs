require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function diagnose() {
  console.log('--- 🔍 FULL SYSTEM DIAGNOSTIC START ---');

  // 1. Audit Target Guests
  console.log('\n[1] Auditing Target Guests (Raghad & Intisar)...');
  const { data: guests, error: guestError } = await supabase
    .from('guests')
    .select('*')
    .or('name.ilike.%رغد%,name.ilike.%انتصار%,name.ilike.%ساره الأحمري%');

  if (guestError) {
    console.error('Guest Fetch Error:', guestError);
    return;
  }

  guests.forEach(g => {
    const raw = g.phone || '';
    const bytes = Buffer.from(raw).toString('hex');
    console.log(`\nGuest: ${g.name}`);
    console.log(`- Raw Phone: "${raw}"`);
    console.log(`- Hex Bytes: ${bytes}`);
    
    // Normalization Logic Test
    let phone = raw.replace(/\D/g, '');
    if (phone.startsWith('05')) phone = '966' + phone.substring(1);
    else if (phone.length === 9 && phone.startsWith('5')) phone = '966' + phone;
    
    console.log(`- Normalized: ${phone}`);
    console.log(`- RSVP Status: ${g.rsvp_status}`);
    console.log(`- Status: ${g.status}`);
  });

  // 2. Audit Message History
  console.log('\n[2] Auditing Message History for Targets...');
  const phoneList = guests.map(g => {
    let p = (g.phone || '').replace(/\D/g, '');
    if (p.startsWith('05')) p = '966' + p.substring(1);
    else if (p.length === 9 && p.startsWith('5')) p = '966' + p;
    return p;
  });

  const { data: messages, error: msgError } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .in('phone', phoneList)
    .order('created_at', { descending: true })
    .limit(20);

  if (msgError) {
    console.error('Message Logs Error:', msgError);
  } else {
    messages.forEach(m => {
      console.log(`\nMessage to: ${m.phone}`);
      console.log(`- ID: ${m.evolution_message_id}`);
      console.log(`- Status: ${m.delivery_status}`);
      console.log(`- Phase: ${m.message_phase}`);
      console.log(`- Created: ${m.created_at}`);
    });
  }

  // 3. Audit Webhook Logic for ID Matching
  console.log('\n[3] Checking for status update mismatches...');
  const orphans = messages.filter(m => m.delivery_status === 'sent');
  console.log(`- Found ${orphans.length} messages stuck in 'sent' status for these targets.`);

  console.log('\n--- 🏁 DIAGNOSTIC COMPLETE ---');
}

diagnose();
