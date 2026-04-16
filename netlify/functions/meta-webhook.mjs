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

  // 2. RAW LOGGING (NEW: For Forensics)
  try {
    const rawPayload = JSON.parse(event.body || '{}');
    await supabase.from('webhook_debug_logs').insert([{
      payload: rawPayload
    }]);
    console.log('[Meta Webhook] Raw Payload Logged to DB');
  } catch (logError) {
    console.error('[Meta Webhook] Failed to log raw payload:', logError.message);
  }

  // 3. Process Data (POST)
  if (event.httpMethod === 'POST') {
    try {
      let rawBody = event.body || '{}';
      if (event.isBase64Encoded) {
        rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
      }
      
      const body = JSON.parse(rawBody);
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0]?.value;

      // EMERGENCY LOGGING: Save raw payload to DB for diagnosis
      if (changes?.messages?.length > 0) {
        const phone = changes.messages[0].from;
        await supabase.from('whatsapp_messages').insert([{
          phone: phone,
          message_text: `DEBUG_RAW_PAYLOAD: ${rawBody.substring(0, 1000)}`,
          status: 'debug',
          message_phase: 'debug'
        }]);
      }

      // 📝 SNOOPER: Extract Message ID or Statuses
      if (changes?.statuses) {
        const s = changes.statuses[0];
        const wamid = s.id;
        const status = s.status; // sent, delivered, read, failed
        const timestamp = s.timestamp;
        
        // 🔎 FORENSICS: Capture Meta Error Codes for "Why it didn't deliver"
        let errorMsg = null;
        if (s.errors && s.errors.length > 0) {
          const err = s.errors[0];
          const codeMap = {
            '131047': 'الرقم غير مسجل في واتساب (رقم خاطئ)',
            '131052': 'المستلم قام بحظر حساب الأعمال (Block)',
            '131049': 'فشل التسليم (حظر من شركة الاتصالات أو الجوال مغلق أو الرقم غير مؤهل)',
            '131051': 'تم رفض القالب من قبل سياسة الواتساب الدولية',
            '131053': 'خطأ في تحميل وسائط الدعوة (الصورة/الفيديو) أو تجاوز حد الإرسال',
            '131026': 'الرسالة غير قابلة للتسليم (الرقم غير صحيح أو واتساب معطل)',
            '131000': 'المستخدم قام بحظر حسابك أو الإبلاغ عنه',
            '131009': 'العميل غير متاح حالياً (الواتساب متوقف عنده)',
            '131042': 'فشل بسبب سياسة الخصوصية الجديدة في واتساب',
            '132000': 'خطأ في بيانات الدعوة (المعطيات غير متوافقة مع القالب)',
            'default': 'خطأ تقني غير محدد من ميتا'
          };
          errorMsg = codeMap[err.code] || `خطأ تقني رقم ${err.code}: ${err.title || err.message}`;
          console.error(`[Webhook] Delivery Failure! Code: ${err.code} for WAMID: ${wamid}`);
        }

        console.log(`[Webhook] Status Update: ${wamid} -> ${status} ${errorMsg ? `(Reason: ${errorMsg})` : ''}`);
        
        const updateData = { 
            delivery_status: status,
            error_message: errorMsg,
            read_at: status === 'read' ? new Date(timestamp * 1000).toISOString() : null,
            delivered_at: (status === 'delivered' || status === 'read') ? new Date(timestamp * 1000).toISOString() : null
        };

        // 1. Update the message log
        const { data: updatedMsg } = await supabase.from('whatsapp_messages')
          .update(updateData)
          .eq('evolution_message_id', wamid)
          .select('guest_id')
          .single();

        // 2. SYNC: Update the main Guest table for real-time dashboard parity
        if (updatedMsg?.guest_id) {
            console.log(`[Webhook Sync] Propagating ${status} to Guest ${updatedMsg.guest_id}`);
            await supabase.from('guests').update({ 
                status: status, // Mirroring the delivery status
                updated_at: new Date().toISOString()
            }).eq('id', updatedMsg.guest_id);
        }
      }

      if (changes?.messages) {
        const message = changes.messages[0];
        const from = message.from; 
        
        // 📝 SNOOPER: Extract Message ID from context for precision matching
        const contextId = message.context?.id;
        console.log(`[Webhook] Processing interaction from ${from}. Context ID: ${contextId}`);
        
        let status = '';

        // A. Filter Message Type
        const analyzeButton = (text) => {
          const t = (text || '').trim().replace(/[إأآا]/g, 'ا'); // Normalize Alifs
          
          const confirmWords = ['تاكيد الحضور', 'نعم', 'ابشر', 'تم', 'اكد', 'CONFIRM', 'YES', 'OK', '1', 'تاكيد'];
          const declineWords = ['اعتذار عن الحضور', 'اعتذر عن الحضور', 'اعتذر', 'اعتذار', 'لا استطيع', 'آسف', 'DECLINE', 'NO', 'SORRY', '2'];
          
          if (confirmWords.some(w => t.includes(w) || t.toUpperCase() === w)) return 'confirmed';
          if (declineWords.some(w => t.includes(w) || t.toUpperCase() === w)) return 'declined';
          return null;
        };

        if (message.type === 'button') {
          status = analyzeButton(message.button.text || message.button.payload);
          if (status) await handleRSVP(from, status, contextId);
        } 
        else if (message.interactive?.button_reply) {
          status = analyzeButton(message.interactive.button_reply.title || message.interactive.button_reply.id);
          if (status) await handleRSVP(from, status, contextId);
        }
        else if (message.text) {
          status = analyzeButton(message.text.body || '');
          if (status) await handleRSVP(from, status, contextId);
        }
      }

      return { statusCode: 200, body: 'OK' };
    } catch (err) {
      console.error('[Meta Webhook] Critical Error:', err);
      return { statusCode: 200, body: 'OK' }; 
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};

async function handleRSVP(phone, status, contextId = null) {
  // Normalize phone for robust matching
  const cleanPhone = phone.replace(/\D/g, ''); 
  const phoneSuffix = cleanPhone.slice(-9); // Get last 9 digits (common in SA)
  
  let targetGuestId = null;
  let targetEventId = null;

  // 1. PHASE 1: PRECISION MATCHING VIA MESSAGE ID (CONTEXT)
  if (contextId) {
    console.log(`[Logic] Searching for Message ID: ${contextId}`);
    const { data: msgLog } = await supabase
      .from('whatsapp_messages')
      .select('guest_id, event_id')
      .eq('evolution_message_id', contextId)
      .limit(1)
      .single();
    
    if (msgLog) {
      targetGuestId = msgLog.guest_id;
      targetEventId = msgLog.event_id;
      console.log(`[Precision Match] SUCCESS! Found Guest ID: ${targetGuestId}`);
    }
  }

  // 2. PHASE 2: FALLBACK TO PHONE + EVENT MATCHING (If context missing or not found)
  if (!targetGuestId) {
    console.log(`[Logic] Falling back to phone matching for suffix ${phoneSuffix}`);
    // Match by phone suffix to handle 05, +966, etc.
    const { data: guestMatch } = await supabase
      .from('guests')
      .select('id, event_id')
      .ilike('phone', `%${phoneSuffix}`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (guestMatch) {
      targetGuestId = guestMatch.id;
      targetEventId = guestMatch.event_id;
      console.log(`[Fallback Match] Found Guest ID: ${targetGuestId}`);
    }
  }

  if (!targetGuestId) {
    console.log(`[Warning] No guest found for phone ${phone}`);
    return;
  }

  // 3. Update DB
  console.log(`[Logic] Updating guest ${targetGuestId} RSVP status to: ${status}`);
  
  const { data: guest } = await supabase.from('guests').select('*, events(name)').eq('id', targetGuestId).single();
  
  await supabase.from('guests').update({ 
    rsvp_status: status,
    // Keep 'status' in sync if business logic uses it
    status: status,
    updated_at: new Date().toISOString()
  }).eq('id', targetGuestId);

  // 4. Send Confirmation Response (Automated)
  const eventName = guest?.events?.name || 'الحفل';
  const guestName = guest?.name || 'ضيفنا الكريم';

  if (status === 'confirmed') {
    if (guest?.card_image_url) {
        const caption = `أهلاً وسهلاً بك يا ${guestName}! 🎉\nيسعدنا تأكيد حضورك في ${eventName}.\n\nتفضل كرت الدخول الشخصي الخاص بك 👇`;
        await sendMetaImage(phone, guest.card_image_url, caption, targetEventId, targetGuestId);
    } else {
        await sendMetaText(phone, `شكراً لك يا ${guestName}! تم تأكيد حضورك في ${eventName}. سنرسل لك كرت الدخول قريباً.`, targetEventId, targetGuestId);
    }
  } else {
    // Explicit Response for Declined (M3tazer)
    const declineText = `نعتذر لعدم تمكنك من الحضور يا ${guestName}. نراك في مناسبات قادمة بإذن الله وحفظه. 🌹`;
    await sendMetaText(phone, declineText, targetEventId, targetGuestId);
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
      const resp = await res.json();
      await supabase.from('whatsapp_messages').insert([{
        guest_id: guestId,
        event_id: eventId,
        phone: to,
        evolution_message_id: resp.messages?.[0]?.id,
        message_phase: 'qr_code',
        message_text: `Auto-QR Response: ${caption}`,
        image_url: imageUrl,
        status: 'sent',
        delivery_status: 'sent'
      }]);
    }
  } catch (err) {
    console.error('[Meta Webhook] Image Send Error:', err);
  }
}

async function sendMetaText(to, text, eventId, guestId) {
  try {
    const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: text } })
    });
    
    if (res.ok) {
        const resp = await res.json();
        // Log automated text response to show in dashboard
        await supabase.from('whatsapp_messages').insert([{
            guest_id: guestId,
            event_id: eventId,
            phone: to,
            evolution_message_id: resp.messages?.[0]?.id,
            message_text: text,
            message_phase: 'rsvp_response',
            status: 'sent',
            delivery_status: 'sent'
        }]);
    }
  } catch (err) {
    console.error('[Meta Webhook] Text Send Error:', err);
  }
}
