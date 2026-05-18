import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || '1031606736708015';
const META_VERSION = 'v21.0';
const VERIFY_TOKEN = 'lony_invite_v1_secure';

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

      // FORENSIC LOGGING (moved to webhook_debug_logs only — no pollution in whatsapp_messages)
      // Raw payload is already logged in lines 35-37 above

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
        
        // --- STATUS ORDER PROTECTION: Never downgrade status ---
        const statusRank = { 'failed': 0, 'sent': 1, 'delivered': 2, 'read': 3 };
        const { data: existingMsg } = await supabase.from('whatsapp_messages')
          .select('delivery_status, guest_id')
          .eq('evolution_message_id', wamid)
          .single();

        // Skip if current status is already higher (e.g. don't overwrite 'read' with 'delivered')
        if (existingMsg && (statusRank[status] || 0) < (statusRank[existingMsg.delivery_status] || 0)) {
            console.log(`[Webhook] Skipping downgrade: ${existingMsg.delivery_status} → ${status}`);
            return { statusCode: 200, body: 'OK' };
        }

        const updateData = { 
            delivery_status: status,
            error_message: errorMsg,
            read_at: status === 'read' ? new Date(timestamp * 1000).toISOString() : null,
            delivered_at: (status === 'delivered' || status === 'read') ? new Date(timestamp * 1000).toISOString() : null
        };

        // 1. Update the message log
        let updatedMsg = null;
        const { data: firstTry } = await supabase.from('whatsapp_messages')
          .update(updateData)
          .eq('evolution_message_id', wamid)
          .select('guest_id')
          .single();

        // --- RACE CONDITION FIX: If wamid not found, wait 2s and retry ---
        // (Meta can send webhook BEFORE our engine writes the row to DB)
        if (!firstTry) {
            console.log(`[Webhook] WAMID ${wamid} not found. Waiting 2s for engine to write...`);
            await new Promise(r => setTimeout(r, 2000));
            const { data: secondTry } = await supabase.from('whatsapp_messages')
              .update(updateData)
              .eq('evolution_message_id', wamid)
              .select('guest_id')
              .single();
            updatedMsg = secondTry;
            if (secondTry) console.log(`[Webhook] Retry SUCCESS for WAMID ${wamid}`);
            else console.warn(`[Webhook] WAMID ${wamid} still not found after retry. Status lost.`);
        } else {
            updatedMsg = firstTry;
        }

        // 2. SYNC: Update the main Guest table for real-time dashboard parity
        if (updatedMsg?.guest_id) {
            console.log(`[Webhook Sync] Propagating ${status} to Guest ${updatedMsg.guest_id}`);
            
            // --- AUTO-BRIDGE TRIGGER ---
            if (s.errors?.[0]?.code === 131049) {
                 // Trigger bridge logic here if needed
            }

            // FIX: Don't overwrite RSVP status (confirmed/declined) with delivery status
            const { data: currentGuest } = await supabase.from('guests')
                .select('rsvp_status, custom_fields')
                .eq('id', updatedMsg.guest_id)
                .single();

            if (!['confirmed', 'declined'].includes(currentGuest?.rsvp_status)) {
                await supabase.from('guests').update({ 
                    status: status || 'sent', 
                    custom_fields: { ...(currentGuest?.custom_fields || {}), last_meta_error: errorMsg },
                    updated_at: new Date().toISOString()
                }).eq('id', updatedMsg.guest_id);
            } else {
                // Only update the timestamp and error info, don't touch status
                await supabase.from('guests').update({ 
                    custom_fields: { ...(currentGuest?.custom_fields || {}), last_meta_error: errorMsg },
                    updated_at: new Date().toISOString()
                }).eq('id', updatedMsg.guest_id);
            }
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
          console.log(`[Webhook] Analyzing button text: "${text}"`);
          const t = (text || '').trim()
            .replace(/[إأآا]/g, 'ا')
            .replace(/[ىيئ]/g, 'ي') // Normalize all YAs and Hamza-on-Ya
            .replace(/\s+/g, '');  // Remove spaces
          
          console.log(`[Webhook] Normalized text: "${t}"`);

          const confirmWords = ['تاكيدالحضور', 'ابشر', 'اكد', 'CONFIRM', 'ACCEPT', 'تاكيد'];
          const declineWords = ['اعتذارعنالحضور', 'اعتذر', 'اعتذار', 'لااستطيع', 'اسف', 'DECLINE', 'NO', 'SORRY'];
          
          // Exact match for short words to avoid bridge collisions
          if (t === 'نعم' || t === 'تم' || t === 'اكد' || t === 'ok' || t === 'yes') return 'confirmed';
          if (t === 'لا' || t === 'اعتذر') return 'declined';

          if (confirmWords.some(w => t.includes(w) || t.toUpperCase() === w)) return 'confirmed';
          if (declineWords.some(w => t.includes(w) || t.toUpperCase() === w)) return 'declined';
          return null;
        };

        // ═══════════════════════════════════════════════════════════════
        // 🌉 STEP 1: BRIDGE CHECK FIRST (before any RSVP logic)
        // Meta sends template button replies as message.type='button'
        // Bridge button text contains "التفاصيل" or "ارسل"
        // RSVP buttons contain "تأكيد الحضور" or "اعتذار عن الحضور"
        // ═══════════════════════════════════════════════════════════════
        let btnText = '';
        if (message.type === 'button') {
          btnText = message.button?.text || message.button?.payload || '';
        } else if (message.interactive?.button_reply) {
          btnText = message.interactive.button_reply.title || message.interactive.button_reply.id || '';
        }

        const isBridgeButton = btnText.includes('التفاصيل') || btnText.includes('ارسل') || btnText.includes('أرسل');

        if (isBridgeButton) {
            console.log(`[Bridge Webhook] 🌉 Guest ${from} pressed bridge button: "${btnText}". Context: ${contextId}`);
            
            let stashedGuest = null;

            // 🎯 PHASE 1: PRECISION MATCHING VIA BRIDGE MESSAGE CONTEXT
            if (contextId) {
                const { data: bridgeMsg } = await supabase
                    .from('whatsapp_messages')
                    .select('guest_id, event_id')
                    .eq('evolution_message_id', contextId)
                    .single();
                
                if (bridgeMsg) {
                    const { data: g } = await supabase
                        .from('guests')
                        .select('*, events(*)')
                        .eq('id', bridgeMsg.guest_id)
                        .single();
                    if (g?.pending_marketing_data) {
                        stashedGuest = g;
                        console.log(`[Bridge Precision] SUCCESS! Matched via context to ${stashedGuest.name} in event ${stashedGuest.event_id}`);
                    }
                }
            }

            // 🔍 PHASE 2: FALLBACK TO SMART PHONE SEARCH (If context match fails)
            if (!stashedGuest) {
                console.log(`[Bridge Fallback] Searching via smart phone search...`);
                const { data: stashedGuests } = await supabase
                    .from('guests')
                    .select('*, events(*)')
                    .ilike('phone', `%${from.slice(-9)}`)
                    .not('pending_marketing_data', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(10);
                
                if (stashedGuests && stashedGuests.length > 0) {
                    // Prioritize the one that has a card_image_url
                    stashedGuest = stashedGuests.find(g => g.card_image_url) || stashedGuests[0];
                    console.log(`[Bridge Smart Match] Picked ${stashedGuest.name} (Has Card: ${!!stashedGuest.card_image_url})`);
                }
            }

            if (stashedGuest?.pending_marketing_data) {
                console.log(`[Bridge Webhook] 🚀 Re-triggering invitation for ${stashedGuest.name}`);
                
                const metaUrl = `https://graph.facebook.com/v21.0/1031606736708015/messages`;
                const metaToken = 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';

                // 🏗️ RECONSTRUCT PAYLOAD FOR MAXIMUM STABILITY
                // We use the GENERAL image for Step 2 as requested by the user
                const eventSettings = stashedGuest.events?.settings || {};
                const imageUrl = eventSettings.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png';
                const groomName = stashedGuest.events?.groom_name || eventSettings.groom_name || 'العريس';
                const brideName = stashedGuest.events?.bride_name || eventSettings.bride_name || 'العروس';
                const eventDate = stashedGuest.events?.date || 'قريباً';
                const eventLocation = stashedGuest.events?.location || 'الموقع';

                const finalPayload = {
                    messaging_product: 'whatsapp',
                    to: from,
                    type: 'template',
                    template: {
                        name: 'get_update',
                        language: { code: 'ar' },
                        components: [
                            { 
                                type: 'header', 
                                parameters: [{ type: 'image', image: { link: imageUrl } }] 
                            },
                            {
                                type: 'body',
                                parameters: [
                                    { type: 'text', parameter_name: 'guest_name', text: String(stashedGuest.name || 'ضيفنا').trim() },
                                    { type: 'text', parameter_name: 'groom_name', text: groomName },
                                    { type: 'text', parameter_name: 'bride_name', text: brideName },
                                    { type: 'text', parameter_name: 'event_date', text: eventDate },
                                    { type: 'text', parameter_name: 'event_location', text: eventLocation }
                                ]
                            },
                            { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                            { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                            { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: encodeURIComponent(stashedGuest.events?.location_maps_url || eventLocation || 'قاعة الاحتفالات') }] }
                        ]
                    }
                };

                const bRes = await fetch(metaUrl, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${metaToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalPayload)
                });

                const bData = await bRes.json().catch(() => ({}));

                // 📝 LOG THE RESULT TO DB FOR FORENSICS
                await supabase.from('webhook_debug_logs').insert([{
                    payload: {
                        bridge_action: 're_send_attempt_v2',
                        guest_name: stashedGuest.name,
                        phone: from,
                        status: bRes.status,
                        response: bData,
                        payload_sent: finalPayload
                    }
                }]);

                if (bRes.ok) {
                    await supabase.from('guests').update({ status: 'sent', pending_marketing_data: null }).eq('id', stashedGuest.id);
                    
                    // LOG the actual invitation
                    await supabase.from('whatsapp_messages').insert([{
                        guest_id: stashedGuest.id,
                        event_id: stashedGuest.event_id,
                        phone: from,
                        evolution_message_id: bData.messages?.[0]?.id,
                        message_phase: 'invitation',
                        message_text: 'دعوة رسمية (بعد الجسر) - نظام مستقر',
                        status: 'sent',
                        delivery_status: 'sent'
                    }]);
                    
                    console.log(`[Bridge Webhook] ✅ Marketing sent and logged for ${stashedGuest.name}`);
                } else {
                    console.error(`[Bridge Webhook] ❌ Re-send failed for ${stashedGuest.name}:`, JSON.stringify(bData));
                    await supabase.from('guests').update({ status: 'bridge_failed' }).eq('id', stashedGuest.id);
                }
            } else {
                console.warn(`[Bridge Webhook] ⚠️ No stashed payload found for phone ${from}`);
            }
            return { statusCode: 200, body: 'OK' }; // STOP HERE for bridge buttons
        }

        // ═══════════════════════════════════════════════════════════════
        // 🗳️ STEP 2: RSVP HANDLING (only if NOT a bridge button)
        // ═══════════════════════════════════════════════════════════════
        if (message.type === 'button') {
          status = analyzeButton(message.button?.text || message.button?.payload);
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
    console.log(`[Logic] Falling back to smart phone matching for suffix ${phoneSuffix}`);
    // Match by phone suffix to handle 05, +966, etc.
    // We fetch multiple records to find the BEST match (prioritizing the one with a personal card)
    const { data: guestMatches } = await supabase
      .from('guests')
      .select('id, event_id, card_image_url, created_at')
      .ilike('phone', `%${phoneSuffix}`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (guestMatches && guestMatches.length > 0) {
      // 🥇 First priority: Most recent guest WITH a personalized card image
      const bestMatch = guestMatches.find(g => g.card_image_url) || guestMatches[0];
      targetGuestId = bestMatch.id;
      targetEventId = bestMatch.event_id;
      console.log(`[Smart Match] Found Guest ID: ${targetGuestId} (Has Card: ${!!bestMatch.card_image_url})`);
    }
  }

  if (!targetGuestId) {
    console.log(`[Warning] No guest found for phone ${phone}`);
    return;
  }

  // 3. Update DB
  console.log(`[Logic] Updating guest ${targetGuestId} RSVP status to: ${status}`);
  
  const { data: guest } = await supabase.from('guests').select('*, events(name)').eq('id', targetGuestId).single();
  
  // --- DEDUPLICATION GUARD ---
  // Allow re-processing 'confirmed' status to let users re-request their cards if they lost them
  // This also enables repeated testing on the same guest
  if (guest?.rsvp_status === status && status !== 'confirmed') {
    console.log(`[Webhook] Duplicate RSVP status (${status}) for guest ${targetGuestId}. Ignoring.`);
    return;
  }
  
  // Update statuses and ensure synchronization
  await supabase.from('guests').update({ 
    rsvp_status: status,
    whatsapp_rsvp_status: status,
    updated_at: new Date().toISOString()
  }).eq('id', targetGuestId);

  // 4. Send Confirmation Response (Automated)
  const eventName = guest?.events?.name || 'الحفل';
  const guestName = guest?.name || 'ضيفنا الكريم';

    if (status === 'confirmed') {
        const { data: eventData } = await supabase.from('events').select('settings, meta_media_id').eq('id', targetEventId).single();
        
        // Priority: 1. Personalized Card -> 2. Event Media ID -> 3. Global Image Link -> 4. Demo Fallback
        let cardUrl = guest?.card_image_url;
        const metaMediaId = eventData?.meta_media_id || eventData?.settings?.meta_media_id;
        const globalImageUrl = eventData?.settings?.global_invite_image_url;

        const caption = `أهلاً وسهلاً بك يا ${guestName}! 🎉\nيسعدنا تأكيد حضورك في ${eventName}.\n\nتفضل كرت الدخول الشخصي الخاص بك 👇`;
        
        if (cardUrl) {
            // Personalized card (usually a link from storage)
            await sendMetaImage(phone, cardUrl, null, caption, targetEventId, targetGuestId);
        } else if (metaMediaId) {
            // Stabilized Event Media ID (Best for delivery)
            await sendMetaImage(phone, null, metaMediaId, caption, targetEventId, targetGuestId);
        } else if (globalImageUrl) {
            // Global Event Image Link
            await sendMetaImage(phone, globalImageUrl, null, caption, targetEventId, targetGuestId);
        } else {
            // Absolute Fallback
            const fallback = `https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/0900ecaf-3d22-4f3b-bc01-9df1ef75f9f7/09b29ea0-47a9-4004-aa71-45d67696b7cc.jpg`;
            await sendMetaImage(phone, fallback, null, caption, targetEventId, targetGuestId);
        }
    } else {
        const declineText = `نعتذر لعدم تمكنك من الحضور يا ${guestName}. نراك في مناسبات قادمة بإذن الله وحفظه. 🌹`;
        await sendMetaText(phone, declineText, targetEventId, targetGuestId);
    }
}

async function sendMetaImage(to, imageUrl, mediaId, caption, eventId, guestId) {
  try {
    const messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: mediaId ? { id: mediaId, caption } : { link: imageUrl, caption }
    };

    const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(messagePayload)
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
        image_url: imageUrl || `MediaID: ${mediaId}`,
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
