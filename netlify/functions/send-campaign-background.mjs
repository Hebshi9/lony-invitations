
import { createClient } from '@supabase/supabase-js';

export default async (req, context) => {
  // Use Service Role Key for backend operations to bypass RLS
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { guestIds, eventId, campaignType, testPhone } = await req.json();

  console.log(`[Background Engine] 🚀 Starting campaign for ${guestIds.length} guests. Type: ${campaignType}`);

  // 1. Fetch Event Data (Top level fields primary, settings secondary)
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (!event) {
    console.error('[Background Engine] ❌ Event not found');
    return;
  }

  // Initialize Progress
  await supabase.from('events').update({ 
    campaign_progress: { 
      current_name: "Gearing up...", 
      count: 0, 
      total: guestIds.length 
    } 
  }).eq('id', eventId);

  // Initialize Progress
  await supabase.from('events').update({ 
    campaign_progress: { 
      current_name: "Gearing up...", 
      count: 0, 
      total: guestIds.length 
    } 
  }).eq('id', eventId);

  // 2. Fetch Targeted Guests
  const { data: guests } = await supabase.from('guests').select('*').in('id', guestIds);
  if (!guests) {
    console.error('[Background Engine] ❌ No guests to process');
    return;
  }

  // 3. Get Global Quota Limit
  const { data: limitSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'meta_daily_limit')
    .single();
  const dailyLimit = parseInt(limitSetting?.value || '250');

  // 4. Process Sending Loop
  let sentCount = 0;
  for (const guest of guests) {
    try {
      // --- QUOTA GUARD ---
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: currentlySent } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday);

      if (currentlySent >= dailyLimit) {
          console.log(`[Background Engine] 🛑 Daily limit reached (${currentlySent}/${dailyLimit}). Pausing campaign.`);
          await supabase.from('events').update({ campaign_status: 'pending_quota' }).eq('id', eventId);
          break; // Stop the loop for today
      }

      // Phone Normalization
      const rawPhone = guest.phone || '';
      let phone = rawPhone.replace(/\D/g, ''); 
      if (phone.startsWith('05')) phone = '966' + phone.substring(1);
      else if (phone.length === 9 && phone.startsWith('5')) phone = '966' + phone;

      // --- TEST OVERRIDE ---
      if (testPhone) {
        console.log(`[Background Engine] 🎯 TEST MODE: Overriding ${phone} with ${testPhone}`);
        phone = testPhone.replace(/\D/g, '');
      }

      if (!phone || phone.length < 9 || phone.length > 13) {
          console.error(`[Background Engine] ⚠️ Invalid phone for guest ${guest.name}: ${rawPhone}`);
          await supabase.from('guests').update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          }).eq('id', guest.id);
          
          await supabase.from('whatsapp_messages').insert([{
            guest_id: guest.id,
            event_id: eventId,
            status: 'failed',
            delivery_status: 'failed',
            error_message: 'رقم جوال غير صالح (طول غير صحيح)',
            message_phase: campaignType
          }]);
          continue;
      }

      console.log(`[Background Engine] ➡️ (${currentlySent + 1}/${dailyLimit}) Sending to ${guest.name}`);
      
      const isQR = campaignType === 'qr_code';
      let payload;
      
      if (isQR) {
        payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone,
            type: 'image',
            image: {
                link: guest.card_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png',
                caption: `أهلاً بك يا ${guest.name} 🌺\n\nتفضل بطاقة الدخول الخاصة بك. بانتظارك!`
            }
        };
      } else {
        // --- TEMPLATE SELECTION (Standard, Reminder, or Eve) ---
        let templateName = (event.template_name || 'lony');
        let headerImage = event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png';
        
        // Handle specialized phases
        if (campaignType === 'reminder_rsvp') {
            templateName = 'lony_reminder'; // Expecting a reminder template in Meta
        } else if (campaignType === 'reminder_eve') {
            templateName = 'lony_eve_reminder'; 
        }

        payload = {
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
                            image: { link: headerImage }
                        }]
                    },
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: guest.name || 'ضيفنا العزيز' },
                            { type: 'text', text: event.groom_name || event.settings?.groom_name || 'العريس' },
                            { type: 'text', text: event.bride_name || event.settings?.bride_name || 'العروس' },
                            { type: 'text', text: event.date || 'موعد الحفل' },
                            { type: 'text', text: event.location || event.location_name || 'قاعة الاحتفالات' }
                        ]
                    }
                ]
            }
        };
      }

      // Update REAL-TIME PROGRESS before sending
      await supabase.from('events').update({ 
        campaign_progress: { 
          current_name: guest.name, 
          count: sentCount + 1, 
          total: guestIds.length 
        } 
      }).eq('id', eventId);

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
        const wamid = metaResp.messages[0].id;
        
        // Log to database
        await supabase.from('whatsapp_messages').insert([{
            guest_id: guest.id,
            event_id: eventId,
            phone: phone,
            message_text: `Meta API Send (${campaignType})`,
            image_url: isQR 
                ? (guest.card_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png')
                : (event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png'),
            evolution_message_id: wamid,
            status: 'sent',
            delivery_status: 'sent',
            provider: 'meta',
            category: isQR ? 'utility' : 'marketing',
            message_phase: campaignType
        }]);

        await supabase.from('guests').update({ 
            status: 'sent', 
            updated_at: new Date().toISOString(),
            reminder_sent: campaignType.includes('reminder') ? true : guest.reminder_sent,
            reminder_sent_at: campaignType.includes('reminder') ? new Date().toISOString() : guest.reminder_sent_at
        }).eq('id', guest.id);
        sentCount++;
      } else {
        const errorMsg = metaResp.error?.message || JSON.stringify(metaResp);
        const errorCode = metaResp.error?.code;

        // --- SMART RECOVERY ENGINE (META-ONLY) ---
        // Codes: 131049 (Rate limiting), 131026 (Privacy policy/Frequency limit), 131051 (Unknown/Busy)
        if (errorCode === 131049 || errorCode === 131026 || errorCode === 131051) {
            const nextMorning = new Date();
            nextMorning.setDate(nextMorning.getDate() + 1);
            nextMorning.setHours(9, 0, 0, 0);

            console.log(`[Recovery] 🛡️ Meta Frequency Block detected for ${guest.name}. Scheduling for: ${nextMorning.toISOString()}`);

            await supabase.from('whatsapp_messages').insert([{
                guest_id: guest.id,
                event_id: eventId,
                phone: phone,
                status: 'scheduled',
                delivery_status: 'pending_recovery',
                scheduled_at: nextMorning.toISOString(),
                error_message: `Meta Rate Limit (Cap: ${errorCode}). Rescheduled for morning.`,
                provider: 'meta',
                category: 'marketing',
                message_phase: isQR ? 'qr_code' : 'invitation'
            }]);

            await supabase.from('guests').update({ status: 'scheduled' }).eq('id', guest.id);
        } else {
            // Hard Failure
            await supabase.from('whatsapp_messages').insert([{
                guest_id: guest.id,
                event_id: eventId,
                phone: phone,
                status: 'failed',
                delivery_status: 'failed',
                error_message: errorMsg,
                provider: 'meta',
                category: isQR ? 'utility' : 'marketing',
                message_phase: isQR ? 'qr_code' : 'invitation'
            }]);

            await supabase.from('guests').update({ status: 'failed' }).eq('id', guest.id);
        }
      }

      // Safe Rate Limit for Meta API (1 message per second)
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (guestErr) {
      console.error(`[Background Engine] ❌ Guest Critical Error: ${guestErr.message}`);
    }
  }

  // Update event status: if sentCount matches target, set idle, else we might be in pending_quota
  // Final Progress Update
  await supabase.from('events').update({ 
    campaign_progress: { 
      current_name: "Completed 🎉", 
      count: guestIds.length, 
      total: guestIds.length 
    } 
  }).eq('id', eventId);

  // Final Progress Update
  await supabase.from('events').update({ 
    campaign_progress: { 
      current_name: "Completed 🎉", 
      count: guestIds.length, 
      total: guestIds.length 
    } 
  }).eq('id', eventId);

  const { data: updatedEvent } = await supabase.from('events').select('campaign_status').eq('id', eventId).single();
  if (updatedEvent?.campaign_status !== 'pending_quota') {
      await supabase.from('events').update({ campaign_status: 'idle' }).eq('id', eventId);
  }
  console.log(`[Background Engine] 🎉 Campaign Finished.`);
};

// Netlify V2 Background Task Config
export const config = {
  path: "/api/send-campaign-background"
};
