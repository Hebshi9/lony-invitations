import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const TOKEN = process.env.META_ACCESS_TOKEN;
const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const EVENT_ID = '049fbefa-18bd-489d-b38d-7502a186d444';

// The CORRECT general invitation image
const GENERAL_IMAGE = 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/0.22618421012214263.jpg';

// Event details
const GROOM = 'سلطان';
const BRIDE = 'وجدان';
const DATE = '2026-06-10';
const LOCATION = 'قاعة حياة الربيع';
const MAP_COORDS = '24.8772285,46.6648354';

function normalizePhone(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('05') && clean.length === 10) clean = '966' + clean.substring(1);
    else if (clean.startsWith('5') && clean.length === 9) clean = '966' + clean;
    return clean;
}

async function sendInvitation(guest) {
    const phone = normalizePhone(guest.phone);
    
    // Skip fake test numbers
    if (phone.includes('000000')) {
        console.log(`⏭️  Skipping test number: ${guest.name}`);
        return { skipped: true };
    }

    const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
            name: 'get_update',
            language: { code: 'ar' },
            components: [
                {
                    type: 'header',
                    parameters: [{ type: 'image', image: { link: GENERAL_IMAGE } }]
                },
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', parameter_name: 'guest_name', text: guest.name },
                        { type: 'text', parameter_name: 'groom_name', text: GROOM },
                        { type: 'text', parameter_name: 'bride_name', text: BRIDE },
                        { type: 'text', parameter_name: 'event_date', text: DATE },
                        { type: 'text', parameter_name: 'event_location', text: LOCATION }
                    ]
                },
                { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: encodeURIComponent(MAP_COORDS) }] }
            ]
        }
    };

    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.messages?.[0]) {
            // Log success to DB
            await supabase.from('whatsapp_messages').insert({
                guest_id: guest.id,
                event_id: EVENT_ID,
                phone: phone,
                status: 'sent',
                delivery_status: 'sent',
                evolution_message_id: data.messages[0].id,
                message_text: 'Force Re-send: General Invitation (corrected image)',
                image_url: GENERAL_IMAGE,
                message_phase: 'invitation'
            });
            await supabase.from('guests').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', guest.id);
            return { success: true, msgId: data.messages[0].id };
        } else {
            const errCode = data.error?.code;
            const errMsg = data.error?.message || 'Unknown error';
            return { success: false, error: errMsg, code: errCode };
        }
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ═══ MAIN ═══
(async () => {
    // 1. Get target guests: No response (pending) + Sarah (failed) + Fathiya
    const { data: targets } = await supabase.from('guests')
        .select('id, name, phone, status, rsvp_status')
        .eq('event_id', EVENT_ID)
        .or('rsvp_status.eq.pending,rsvp_status.is.null,status.eq.failed')
        .order('name');

    // Filter out test/sample numbers
    const realTargets = targets.filter(g => !g.phone.includes('000000'));
    
    console.log(`\n🎯 Total targets to send: ${realTargets.length}`);
    console.log(`📷 Image: ${GENERAL_IMAGE}`);
    console.log(`📋 Template: get_update\n`);

    let sent = 0, failed = 0, skipped = 0;

    for (let i = 0; i < realTargets.length; i++) {
        const guest = realTargets[i];
        console.log(`[${i + 1}/${realTargets.length}] Sending to: ${guest.name} (${guest.phone})...`);

        const result = await sendInvitation(guest);

        if (result.skipped) {
            skipped++;
        } else if (result.success) {
            sent++;
            console.log(`  ✅ Success`);
        } else {
            failed++;
            console.log(`  ❌ Failed: ${result.error} (code: ${result.code})`);
        }

        // Throttle: 2.5 seconds between messages
        if (i < realTargets.length - 1) {
            await new Promise(r => setTimeout(r, 2500));
        }
    }

    console.log(`\n🏁 DONE! Sent: ${sent} | Failed: ${failed} | Skipped: ${skipped}`);
})();
