require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function setupTest() {
  console.log('--- Setting up Ultimate Precision Test ---');

  // 1. Create a New Event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert([{
      name: 'اختبار لوني النهائي 🏁',
      token: 'TOKEN-' + Date.now(),
      date: new Date().toISOString(),
      rsvp_cycle_status: 'active'
    }])
    .select()
    .single();

  if (eventError) {
    console.error('Event Creation Error:', eventError);
    return;
  }
  console.log(`Created Event: ${event.id} (${event.name})`);

  // 2. Add Guests
  const guestsToInsert = [
    {
      event_id: event.id,
      name: 'ضيف الاختبار (الرقم الجديد)',
      phone: '966569667344',
      rsvp_status: 'pending',
      is_demo: false,
      card_image_url: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/17490649-b5cb-462b-9f09-6e0a252d4676/c7316bed-1aff-4250-961e-7b533ea550e6.jpg'
    }
  ];

  const { data: guests, error: guestError } = await supabase
    .from('guests')
    .insert(guestsToInsert)
    .select();

  if (guestError) {
    console.error('Guest Insertion Error:', guestError);
    return;
  }
  
  console.log(`Created ${guests.length} Guests successfully.`);

  // 3. Insert Mock Invitation Logs (to trigger Precision Matching)
  const messagesToInsert = guests.map(g => ({
    guest_id: g.id,
    event_id: event.id,
    phone: g.phone,
    message_phase: 'invitation',
    status: 'sent',
    delivery_status: 'sent',
    message_text: 'Precision Test Invitation'
  }));

  const { error: msgError } = await supabase
    .from('whatsapp_messages')
    .insert(messagesToInsert);

  if (msgError) {
    console.error('Message Log Error:', msgError);
    return;
  }

  console.log('--- Setup Complete ---');
  console.log('Event ID:', event.id);
  console.log('Ahmed Guest ID:', guests[0].id);
  console.log('Sara Guest ID:', guests[1].id);
}

setupTest();
