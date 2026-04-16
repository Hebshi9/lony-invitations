require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMisclassifications() {
  console.log('🔍 AUDITING FOR SIMILAR MISCLASSIFICATIONS...');
  
  const { data: confirmed } = await supabase
    .from('guests')
    .select('id, name, phone, rsvp_status')
    .eq('rsvp_status', 'confirmed');

  if (!confirmed) return;

  for (const c of confirmed) {
    const phone = (c.phone || '').replace(/\D/g, '');
    const { data: logs } = await supabase
      .from('whatsapp_messages')
      .select('message_text')
      .eq('phone', phone)
      .ilike('message_text', '%DEBUG_RAW_PAYLOAD%');

    if (logs) {
      logs.forEach(l => {
        if (l.message_text.includes('اعتذار')) {
          console.log(`⚠️ POTENTIAL ERROR FOUND: ${c.name} (${c.phone}) - Confirmed in DB but log says Decline.`);
        }
      });
    }
  }
  console.log('Audit complete.');
}

checkMisclassifications();
