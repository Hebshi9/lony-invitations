import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_VERSION = 'v21.0';
const VERIFY_TOKEN = 'lony_invite_v1_secure';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const handler = async (event) => {
  console.log(`[Meta Webhook] Incoming ${event.httpMethod} request`);

  // 1. Meta Validation (GET)
  if (event.httpMethod === 'GET') {
    const params = event.queryStringParameters || {};
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Meta Webhook] Verification Successful');
      return { statusCode: 200, body: challenge };
    }
    console.warn('[Meta Webhook] Verification Failed');
    return { statusCode: 403, body: 'Forbidden' };
  }

  // 2. RSVP Processing (POST)
  if (event.httpMethod === 'POST') {
    try {
      let rawBody = event.body || '{}';
      if (event.isBase64Encoded) {
        rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
      }
      
      const body = JSON.parse(rawBody);
      
      // EMERGENCY LOGGING: Save raw payload to DB for diagnosis if it's a real message
      const changes = body.entry?.[0]?.changes?.[0]?.value;
      if (changes?.messages?.length > 0) {
        const phone = changes.messages[0].from;
        await supabase.from('whatsapp_messages').insert([{
          phone: phone,
          message_text: `DEBUG_RAW_PAYLOAD: ${rawBody.substring(0, 1000)}`,
          status: 'debug',
          message_phase: 'debug'
        }]);
      }

      if (changes?.messages) {
        const message = changes.messages[0];
        const from = message.from; 
        
        // 📝 SNOOPER: Log the presence of context ID for precision verification
        const contextId = message.context?.id;
        console.log(`[Webhook] Processing click from ${from}. Context ID: ${contextId}`);

        let combinedContent = '';
        let status = '';

        // A. Detect Button Clicks (Mapped to internal status)
        if (message.type === 'button') {
          const payload = message.button.payload || '';
          const text = message.button.text || '';
          const combined = (payload + ' ' + text).toUpperCase();
          
          const isConfirm = combined.includes('CONFIRM') || combined.includes('تأكيد') || combined.includes('حضور') || combined.includes('YES');
          const isDecline = combined.includes('DECLINE') || combined.includes('اعتذار') || combined.includes('NO');
          
          status = isConfirm ? 'confirmed' : (isDecline ? 'declined' : null);
          if (status) await handleRSVP(from, status, contextId);
        } 
        // B. Detect Interactive Replies
        else if (message.interactive?.button_reply) {
          combinedContent = (message.interactive.button_reply.title || message.interactive.button_reply.id || '').toUpperCase();
          const isConfirm = combinedContent.includes('CONFIRM') || combinedContent.includes('تأكيد') || combinedContent.includes('حضور') || combinedContent.includes('YES');
          const isDecline = combinedContent.includes('DECLINE') || combinedContent.includes('اعتذار') || combinedContent.includes('NO');
          status = isConfirm ? 'confirmed' : (isDecline ? 'declined' : null);
          if (status) await handleRSVP(from, status, contextId);
        }
        // C. Detect Text Messages
        else if (message.text) {
          combinedContent = (message.text.body || '').toUpperCase();
          const isConfirm = combinedContent.includes('CONFIRM') || combinedContent.includes('تأكيد') || combinedContent.includes('حضور') || combinedContent.includes('YES');
          const isDecline = combinedContent.includes('DECLINE') || combinedContent.includes('اعتذار') || combinedContent.includes('NO');
          status = isConfirm ? 'confirmed' : (isDecline ? 'declined' : null);
          if (status) await handleRSVP(from, status, contextId);
        }
      }

      return { statusCode: 200, body: 'OK' };
    } catch (err) {
      console.error('[Meta Webhook] Critical Error:', err);
      return { statusCode: 200, body: 'OK' }; // Always return 200 to Meta
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};

async function handleRSVP(phone, status, contextId = null) {
  const digits = phone.replace(/\D/g, '');
  const withPlus = '+' + digits;
  const searchPart = digits.slice(-9);

  let targetGuest = null;
  let targetEventId = null;

  // 1. PHASE 1: PRECISION MATCHING VIA MESSAGE ID (CONTEXT)
  if (contextId) {
    const { data: msgLog } = await supabase
      .from('whatsapp_messages')
      .select('guest_id, event_id, guests!inner(*, events(name))')
      .eq('evolution_message_id', contextId)
      .single();
    
    if (msgLog) {
      targetGuest = msgLog.guests;
      targetEventId = msgLog.event_id;
      console.log(`[Precision Match] Found Guest: ${targetGuest.name} in Event: ${targetEventId}`);
    }
  }

  // 2. PHASE 2: FALLBACK TO PHONE MATCHING (If context missing or failed)
  if (!targetGuest) {
    const { data: recentMsgs } = await supabase
      .from('whatsapp_messages')
      .select('guest_id, event_id, guests!inner(*, events(name))')
      .or(`phone.eq.${digits},phone.eq.${withPlus}`)
      .eq('message_phase', 'invitation')
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentMsgs && recentMsgs.length > 0) {
      targetGuest = recentMsgs[0].guests;
      targetEventId = recentMsgs[0].event_id;
    }
  }

  if (!targetGuest) {
    console.log(`[Warning] No guest found for phone ${phone}`);
    return;
  }

  const guest = targetGuest;
  const eventId = targetEventId || guest.event_id;
  const eventName = guest.events?.name || 'الحفل';

  // 2. Update DB
  await supabase.from('guests').update({ 
    rsvp_status: status,
    status: status,
    updated_at: new Date().toISOString()
  }).eq('id', guest.id);

  // 3. Send QR Card (only if confirmed)
  if (status === 'confirmed' && guest.card_image_url) {
    const caption = `أهلاً وسهلاً بك يا ${guest.name}! 🎉\nيسعدنا تأكيد حضورك في ${eventName}.\n\nتفضل كرت الدخول الشخصي الخاص بك 👇`;
    await sendMetaImage(phone, guest.card_image_url, caption, eventId, guest.id);
  } else if (status === 'confirmed') {
    await sendMetaText(phone, `شكراً لك! تم تأكيد حضورك في ${eventName}. سنرسل لك كرت الدخول قريباً.`);
  }
}

async function sendMetaImage(to, imageUrl, caption, eventId, guestId) {
  try {
    const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: { link: imageUrl, caption }
      })
    });
    
    if (res.ok) {
      await supabase.from('whatsapp_messages').insert([{
        guest_id: guestId,
        event_id: eventId,
        phone: to,
        message_phase: 'qr_code',
        message_text: 'Auto-QR Response',
        image_url: imageUrl,
        status: 'sent',
        delivery_status: 'sent'
      }]);
    }
  } catch (err) {
    console.error('[Meta Webhook] Image Send Error:', err);
  }
}

async function sendMetaText(to, text) {
  await fetch(`https://graph.facebook.com/${META_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: text } })
  });
}
