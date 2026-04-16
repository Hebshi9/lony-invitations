require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function verify() {
  console.log('🔍 FETCHING RAW BUTTON PAYLOADS FROM LIVE LOGS...');
  const { data } = await s.from('whatsapp_messages')
    .select('message_text, phone')
    .ilike('message_text', '%DEBUG_RAW_PAYLOAD%')
    .order('created_at', { desc: true })
    .limit(30);

  if (!data) return;

  const results = [];
  data.forEach(l => {
    try {
      const match = l.message_text.match(/DEBUG_RAW_PAYLOAD: (\{.*\})/);
      if (match) {
        const json = JSON.parse(match[1]);
        const msg = json.entry[0].changes[0].value.messages[0];
        if (msg.type === 'button') {
          results.push({
            phone: l.phone,
            text: msg.button.text,
            payload: msg.button.payload
          });
        }
      }
    } catch (e) {}
  });

  console.log('\n--- DETECTED PHYSICAL BUTTONS ---');
  results.forEach((r, i) => {
    console.log(`[${i+1}] Phone: ${r.phone} | Text: "${r.text}" | Payload: "${r.payload}"`);
  });
  
  if (results.length === 0) {
      console.log('No button interactions found in recent logs.');
  }
}

verify();
