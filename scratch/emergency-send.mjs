import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// === CONFIG ===
const NEW_TOKEN = 'EAAV4hiaLibsBRn4mCPQ8sxJEyY5rXUaQ8xJhDuyBxVwkTnEx1ZArMK2YTZBuNROKsy0NBNUUUZBX77WrZAFfYMdMItbY7y5ESIwtS8KVwkpuhIq727wfmhC5biAWVuh6tbDkZAbNhFAc0yq0jZCCNebdZACCkZCOC76BzJZCa4Dwr4F7e0hIHZAI9rjdcPpVGJZAZBFEYrUPAYM2y5wDAk2REfWOgeEKrH6KvBQmufpbE6D36MOlFDG1TH3ZBWGB0PxyoCPuBr7ijZBuvFMOEiGOhEUsJaYITD';
const PHONE_ID = '1031606736708015';

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

// ⚠️ غيّر هذا إلى ID الحدث المطلوب
const EVENT_ID = process.argv[2];

if (!EVENT_ID) {
    console.error('❌ Usage: node scratch/emergency-send.mjs <EVENT_ID>');
    console.error('   مثال: node scratch/emergency-send.mjs a5931bed-8ae0-4881-9a6d-f55964859426');
    process.exit(1);
}

async function sendToGuest(guest, event) {
    let phone = (guest.phone || '').replace(/\D/g, '');
    if (phone.startsWith('05')) phone = '966' + phone.substring(1);
    else if (phone.startsWith('5') && phone.length === 9) phone = '966' + phone;

    if (!phone || phone.length < 9) return { success: false, error: 'رقم غير صحيح', name: guest.name };

    const groomName = event.groom_name || event.settings?.groom_name || 'العريس';
    const brideName = event.bride_name || event.settings?.bride_name || 'العروس';
    const eventDate = event.date || 'قريباً';
    const eventLocation = event.location || 'الموقع';
    const headerImage = event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png';
    let templateName = event.template_name || 'get_update';
    if (templateName === 'lony') templateName = 'get_update';
    const mapCoords = encodeURIComponent(event.location_maps_url || eventLocation);

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
                    parameters: [{ type: 'image', image: { link: headerImage } }]
                },
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', parameter_name: 'guest_name', text: guest.name },
                        { type: 'text', parameter_name: 'groom_name', text: groomName },
                        { type: 'text', parameter_name: 'bride_name', text: brideName },
                        { type: 'text', parameter_name: 'event_date', text: eventDate },
                        { type: 'text', parameter_name: 'event_location', text: eventLocation }
                    ]
                },
                { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: mapCoords }] }
            ]
        }
    };

    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${NEW_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            // Log success to DB
            await supabase.from('whatsapp_messages').insert({
                guest_id: guest.id,
                event_id: EVENT_ID,
                phone: phone,
                status: 'sent',
                delivery_status: 'sent',
                evolution_message_id: data.messages?.[0]?.id,
                message_phase: 'invitation',
                message_text: 'دعوة رسمية'
            });
            await supabase.from('guests').update({ status: 'sent' }).eq('id', guest.id);
            return { success: true, name: guest.name, phone };
        } else {
            const errorMsg = data.error?.message || 'Meta Error';
            await supabase.from('whatsapp_messages').insert({
                guest_id: guest.id,
                event_id: EVENT_ID,
                phone: phone,
                status: 'failed',
                error_message: errorMsg,
                message_text: 'فشل إرسال الدعوة',
                message_phase: 'invitation'
            });
            await supabase.from('guests').update({ status: 'failed' }).eq('id', guest.id);
            return { success: false, name: guest.name, error: errorMsg };
        }
    } catch (e) {
        return { success: false, name: guest.name, error: e.message };
    }
}

async function run() {
    console.log(`\n🚀 ═══════════════════════════════════════`);
    console.log(`   إرسال طوارئ مباشر عبر Meta API`);
    console.log(`═══════════════════════════════════════\n`);

    // 1. Fetch event
    const { data: event, error: evErr } = await supabase.from('events').select('*').eq('id', EVENT_ID).single();
    if (evErr || !event) { console.error('❌ الحدث غير موجود:', evErr); return; }
    console.log(`📋 الحدث: ${event.name}`);

    // 2. Fetch ALL guests
    const { data: allGuests } = await supabase.from('guests').select('id, name, phone, status').eq('event_id', EVENT_ID);
    console.log(`👥 إجمالي الضيوف: ${allGuests.length}`);

    // 3. Filter: skip already sent in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentMsgs } = await supabase
        .from('whatsapp_messages')
        .select('guest_id')
        .eq('event_id', EVENT_ID)
        .eq('status', 'sent')
        .gte('created_at', yesterday);

    const recentIds = new Set((recentMsgs || []).map(m => m.guest_id));
    const targetGuests = allGuests.filter(g => !recentIds.has(g.id) && g.phone);

    console.log(`📨 تم إرسالهم خلال 24 ساعة: ${recentIds.size}`);
    console.log(`🎯 المستهدفون للإرسال الآن: ${targetGuests.length}`);
    console.log(`\n⏳ بدء الإرسال...\n`);

    let sent = 0, failed = 0;

    for (let i = 0; i < targetGuests.length; i++) {
        const guest = targetGuests[i];
        const result = await sendToGuest(guest, event);

        if (result.success) {
            sent++;
            console.log(`✅ [${i+1}/${targetGuests.length}] ${result.name} (${result.phone})`);
        } else {
            failed++;
            console.log(`❌ [${i+1}/${targetGuests.length}] ${result.name}: ${result.error}`);
        }

        // تأخير بسيط بين كل رسالة (1.5 ثانية) لتجنب حظر Meta
        if (i < targetGuests.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`🏁 النتيجة النهائية:`);
    console.log(`   ✅ تم الإرسال: ${sent}`);
    console.log(`   ❌ فشل: ${failed}`);
    console.log(`   📊 الإجمالي: ${targetGuests.length}`);
    console.log(`═══════════════════════════════════════\n`);
}

run();
