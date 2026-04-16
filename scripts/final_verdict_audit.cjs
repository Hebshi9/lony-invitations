require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function runVerdict() {
  console.log('🔍 ANALYZING BLACK BOX (RAW WEBHOOK LOGS)...');
  
  const { data: logs } = await supabase
    .from('webhook_debug_logs')
    .select('*')
    .order('created_at', { descending: true })
    .limit(10);

  if (!logs || logs.length === 0) {
    console.log('❌ UNEXPECTED: The "Black Box" is empty. Check if table creation or deploy failed.');
    return;
  }

  console.log(`Analyzing last ${logs.length} signals from Meta...`);
  
  let foundIntisar = false;
  logs.forEach(log => {
      const payloadStr = JSON.stringify(log.payload);
      if (payloadStr.includes('966535520888')) {
          foundIntisar = true;
          console.log('\n🌟 FOUND SIGNAL FOR INTISAR!');
          console.log(`- Time: ${log.created_at}`);
          console.log(`- Payload: ${payloadStr.substring(0, 500)}...`);
      }
  });

  if (!foundIntisar) {
    console.log('\n⚠️ VERDICT: Meta is SILENT.');
    console.log('We checked the last 10 raw signals; none are for Intisar.');
    console.log('This means Meta is NOT sending any "Delivered" or "Read" signals to our server for her.');
    console.log('Reason: The message hasn\'t been delivered to her handset (One grey tick), so Meta has nothing to tell us.');
  } else {
    console.log('\n✅ VERDICT: Signal Detected.');
    console.log('We found a raw signal for Intisar. Now we must check why the status wasn\'t updated.');
  }
}

runVerdict();
