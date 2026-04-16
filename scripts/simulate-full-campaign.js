import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function simulate() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY 
  );

  const guestIds = [
    'de726e31-8fc2-44e5-9952-3f0cd6c6bdc9', // Ahmed Al-Habshi
    'f2d58cf7-2e81-4e37-9407-5e9804d6d6f9'  // Sarah
  ];
  const eventId = '17490649-b5cb-462b-9f09-6e0a252d4676';

  console.log('🔄 ==========================================');
  console.log('🔄 1. PHASE 1: SENDING INVITATIONS...');
  console.log('🔄 ==========================================');
  
  await fetch('https://lonyinvite.netlify.app/api/send-campaign-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestIds, eventId, campaignType: 'invite' })
  });
  console.log('✅ Invitation triggered! Waiting 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('\n✅ 2. SIMULATING RSVP (Guest clicks تأكيد الحضور)...');
  const { error: updErr } = await supabase
      .from('guests')
      .update({ status: 'confirmed' })
      .in('id', guestIds);
  
  if (updErr) console.error('❌ Error updating RSVP:', updErr);
  else console.log('✅ Both Ahmed and Sarah RSVP status is now CONFIRMED!');

  console.log('\n🔄 ==========================================');
  console.log('🔄 3. PHASE 2: SENDING QR CARDS...');
  console.log('🔄 ==========================================');
  
  await fetch('https://lonyinvite.netlify.app/api/send-campaign-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestIds, eventId, campaignType: 'qr_code' })
  });
  console.log('✅ QR Cards triggered!');
  
  console.log('\n🏁 Simulation completed sequentially!');
}

simulate().catch(console.error);
