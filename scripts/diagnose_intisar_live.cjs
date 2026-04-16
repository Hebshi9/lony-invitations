require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const INTISAR_PHONE = '966535520888';

async function diagnose() {
  console.log('🚀 TRIGGERING 100% TRANSPARENT TEST FOR INTISAR (V4 - EXACT STRUCTURE)...');
  
  // Use EXACTLY the same structure from manual_invitation_emergency.cjs
  const payload = {
    messaging_product: 'whatsapp',
    to: INTISAR_PHONE,
    type: 'template',
    template: {
      name: 'lony',
      language: { code: 'ar' },
      components: [
        {
          type: 'header',
          parameters: [{ type: 'image', image: { link: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/wedding_invite.jpg' } }]
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'guest_name', text: 'انتصار' },
            { type: 'text', parameter_name: 'groom_name', text: 'خالد' },
            { type: 'text', parameter_name: 'bride_name', text: 'رغد' },
            { type: 'text', parameter_name: 'event_date', text: '2026-04-18' },
            { type: 'text', parameter_name: 'event_location', text: 'فندق بيوت مكين قاعة الاوركيد' }
          ]
        }
      ]
    }
  };

  const response = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  if (!response.ok) {
    console.error('❌ META REJECTED INITIAL SEND:', JSON.stringify(resJson));
    return;
  }

  const wamid = resJson.messages[0].id;
  console.log(`✅ INITIAL SEND SUCCESS! WAMID: ${wamid}`);
  console.log('⏳ WAITING 60 SECONDS FOR FORENSIC FEEDBACK FROM WEBHOOK...');

  // 2. Poll Database for Forensic Updates
  for (let i = 0; i < 60; i++) {
    const { data: msg } = await supabase
      .from('whatsapp_messages')
      .select('delivery_status, error_message, phone')
      .eq('evolution_message_id', wamid)
      .single();

    if (msg?.error_message) {
      console.log('\n🚨 HITS! FORENSIC REASON DETECTED:');
      console.log(`- Status: ${msg.delivery_status}`);
      console.log(`- Reason: ${msg.error_message}`);
      return;
    }

    if (msg?.delivery_status === 'delivered') {
      console.log('\n🟢 SUCCESS! Message reached Intisar\'s phone (Delivered).');
      return;
    }

    if (msg?.delivery_status === 'read') {
      console.log('\n🔵 DOUBLE SUCCESS! Intisar has READ the message.');
      return;
    }

    if (i % 5 === 0) process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n⌛ TIMEOUT: Still at "Sent". This confirms a Carrier block or Phone is Offline.');
}

diagnose();
