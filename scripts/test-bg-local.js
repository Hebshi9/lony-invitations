import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function testBgLocal() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY // Using anon locally just to test
  );

  const guestIds = ['de726e31-8fc2-44e5-9952-3f0cd6c6bdc9'];
  const eventId = '17490649-b5cb-462b-9f09-6e0a252d4676';
  const campaignType = 'invite';

  console.log(`[Background Engine] 🚀 Starting campaign for ${guestIds.length} guests.`);

  // 1. Fetch Event Data
  const { data: event, error: evtErr } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (evtErr) return console.error('EvtErr:', evtErr);
  if (!event) return console.error('[Background Engine] ❌ Event not found');

  // 2. Fetch Targeted Guests
  const { data: guests, error: gstErr } = await supabase.from('guests').select('*').in('id', guestIds);
  if (gstErr) return console.error('GstErr:', gstErr);
  if (!guests) return console.error('[Background Engine] ❌ No guests to process');

  // 3. Process Sending Loop
  for (const guest of guests) {
    try {
      let phone = guest.phone.replace(/\D/g, '');
      if (phone.startsWith('05')) phone = '966' + phone.substring(1);
      else if (phone.length === 9 && phone.startsWith('5')) phone = '966' + phone;

      const isQR = campaignType === 'qr_code';
      const templateName = 'lony';

      const bodyParams = isQR ? [
        { type: 'text', parameter_name: 'guest_name', text: guest.name || 'ضيفنا العزيز' },
        { type: 'text', parameter_name: 'groom_name', text: event.groom_name || event.settings?.groom_name || 'أحمد' },
        { type: 'text', parameter_name: 'bride_name', text: event.bride_name || event.settings?.bride_name || 'سارة' },
        { type: 'text', parameter_name: 'event_date', text: guest.table_no || 'لم يحدد' },
        { type: 'text', parameter_name: 'event_location', text: guest.category || 'عام' }
      ] : [
        { type: 'text', parameter_name: 'guest_name', text: guest.name || 'ضيفنا العزيز' },
        { type: 'text', parameter_name: 'groom_name', text: event.groom_name || event.settings?.groom_name || 'أحمد' },
        { type: 'text', parameter_name: 'bride_name', text: event.bride_name || event.settings?.bride_name || 'سارة' },
        { type: 'text', parameter_name: 'event_date', text: event.date || '2026-04-20' },
        { type: 'text', parameter_name: 'event_location', text: event.location || event.location_name || 'قاعة الاحتفالات' }
      ];

      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'ar' },
          components: [
            {
              type: 'header',
              parameters: [{
                type: 'image',
                image: { 
                    link: isQR 
                    ? (guest.card_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png')
                    : (event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png')
                }
              }]
            },
            {
              type: 'body',
              parameters: bodyParams
            }
          ]
        }
      };

      console.log(`[Background Engine] ➡️ Attempting send to ${guest.name} (${phone})`);
      console.log('Payload:', JSON.stringify(payload, null, 2));

      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      const metaResp = await metaRes.json();

      if (metaRes.ok && metaResp.messages) {
        console.log(`[Background Engine] ✅ Sent to ${guest.name}`);
        const { error: insErr } = await supabase.from('whatsapp_messages').insert([{
            guest_id: guest.id,
            event_id: eventId,
            evolution_message_id: metaResp.messages[0].id,
            status: 'sent',
            message_phase: isQR ? 'qr_code' : 'invitation'
        }]);
        if (insErr) console.error('Insert Error:', insErr);
      } else {
        console.error(`[Background Engine] ❌ Meta Error for ${guest.name}:`, JSON.stringify(metaResp));
      }
    } catch (guestErr) {
      console.error(`[Background Engine] ❌ Guest Critical Error: ${guestErr.message}`);
    }
  }
}
testBgLocal();
