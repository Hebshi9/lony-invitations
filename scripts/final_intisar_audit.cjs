require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function runAudit() {
  console.log('🔍 FINAL INTISAR DELIVERY AUDIT (THE TRUTH)...');
  
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('phone', '966535520888')
    .order('created_at', { descending: true });

  if (!messages || messages.length === 0) {
    console.log('No messages found for Intisar.');
    return;
  }

  console.log(`Total messages sent to Intisar: ${messages.length}`);
  
  messages.forEach(m => {
    console.log(`\nTime: ${m.created_at}`);
    console.log(`- Phase: ${m.message_phase}`);
    console.log(`- Status: ${m.delivery_status || 'sent'}`);
    console.log(`- Meta ID: ${m.evolution_message_id}`);
    console.log(`- Error: ${m.error_message || 'None'}`);
  });

  const allSent = messages.every(m => m.delivery_status === 'sent' || !m.delivery_status);
  
  if (allSent) {
    console.log('\n❌ RESULT: All messages are stuck at "SENT".');
    console.log('This means Meta accepted the message, but it NEVER reached Intisar\'s phone.');
    console.log('Cause: Phone is offline, or Carrier (STC/Zain) is blocking the business sender for this specific user.');
  } else {
    console.log('\n⚠️ RESULT: Some status changes detected.');
  }
}

runAudit();
