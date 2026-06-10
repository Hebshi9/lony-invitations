import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const NEW_TOKEN = 'EAAV4hiaLibsBRn4mCPQ8sxJEyY5rXUaQ8xJhDuyBxVwkTnEx1ZArMK2YTZBuNROKsy0NBNUUUZBX77WrZAFfYMdMItbY7y5ESIwtS8KVwkpuhIq727wfmhC5biAWVuh6tbDkZAbNhFAc0yq0jZCCNebdZACCkZCOC76BzJZCa4Dwr4F7e0hIHZAI9rjdcPpVGJZAZBFEYrUPAYM2y5wDAk2REfWOgeEKrH6KvBQmufpbE6D36MOlFDG1TH3ZBWGB0PxyoCPuBr7ijZBuvFMOEiGOhEUsJaYITD';
const PHONE_ID = '1031606736708015';

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'e5c16571-e50c-4ff3-ab76-259813717c62'; // حفل زفاف الطحامي

async function run() {
    console.log(`\n🚀 ═══════════════════════════════════════`);
    console.log(`   إرسال جسر العبور الجماعي — حفل الطحامي`);
    console.log(`═══════════════════════════════════════\n`);

    // 1. Fetch event
    const { data: event } = await supabase.from('events').select('*').eq('id', EVENT_ID).single();
    if (!event) { console.error('❌ الحدث غير موجود'); return; }
    
    const groomName = event.groom_name || 'العريس';
    const brideName = event.bride_name || 'العروس';
    const eventDate = event.date || 'قريباً';
    const eventLocation = event.location || 'الموقع';
    const headerImage = event.settings?.global_invite_image_url;
    let templateName = event.template_name || 'get_update';
    if (templateName === 'lony') templateName = 'get_update';
    const mapCoords = encodeURIComponent(event.location_maps_url || eventLocation);
    const familyName = event.settings?.family_name || event.name || 'زفاف الطحامي';

    console.log(`📋 الحدث: ${event.name}`);
    console.log(`📝 Template: ${templateName}`);
    console.log(`🖼️ صورة: ${headerImage ? 'موجودة' : '❌ غير موجودة'}`);

    // 2. Fetch all guests
    const { data: allGuests } = await supabase.from('guests').select('id, name, phone, status')
        .eq('event_id', EVENT_ID);
    
    console.log(`👥 إجمالي الضيوف: ${allGuests.length}`);

    // 3. Filter: skip already bridged/sent
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentMsgs } = await supabase
        .from('whatsapp_messages')
        .select('guest_id')
        .eq('event_id', EVENT_ID)
        .gte('created_at', yesterday);

    const recentIds = new Set((recentMsgs || []).map(m => m.guest_id));
    const targetGuests = allGuests.filter(g => !recentIds.has(g.id) && g.phone);

    console.log(`📨 تم إرسالهم خلال 24 ساعة: ${recentIds.size}`);
    console.log(`🎯 المستهدفون للإرسال: ${targetGuests.length}`);
    console.log(`\n⏳ بدء الإرسال...\n`);

    let sent = 0, failed = 0;

    for (let i = 0; i < targetGuests.length; i++) {
        const guest = targetGuests[i];
        let phone = (guest.phone || '').replace(/\D/g, '');
        if (phone.startsWith('05')) phone = '966' + phone.substring(1);
        else if (phone.startsWith('5') && phone.length === 9) phone = '966' + phone;

        if (!phone || phone.length < 9) {
            failed++;
            console.log(`❌ [${i+1}/${targetGuests.length}] ${guest.name}: رقم غير صحيح`);
            continue;
        }

        // Build invitation payload to stash
        const invitationPayload = {
            messaging_product: 'whatsapp', to: phone, type: 'template',
            template: {
                name: templateName, language: { code: 'ar' },
                components: [
                    { type: 'header', parameters: [{ type: 'image', image: { link: headerImage } }] },
                    { type: 'body', parameters: [
                        { type: 'text', parameter_name: 'guest_name', text: guest.name },
                        { type: 'text', parameter_name: 'groom_name', text: groomName },
                        { type: 'text', parameter_name: 'bride_name', text: brideName },
                        { type: 'text', parameter_name: 'event_date', text: eventDate },
                        { type: 'text', parameter_name: 'event_location', text: eventLocation }
                    ]},
                    { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                    { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                    { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: mapCoords }] }
                ]
            }
        };

        // Stash invitation in guest record
        await supabase.from('guests').update({ 
            pending_marketing_data: invitationPayload,
            status: 'bridging'
        }).eq('id', guest.id);

        // Send bridge message
        const bridgePayload = {
            messaging_product: 'whatsapp', to: phone, type: 'template',
            template: {
                name: 'lony_invite_bridge', language: { code: 'ar' },
                components: [{
                    type: 'body',
                    parameters: [
                        { type: 'text', parameter_name: 'guest_name', text: guest.name },
                        { type: 'text', parameter_name: 'sender_name', text: `زفاف ${familyName}` }
                    ]
                }]
            }
        };

        try {
            const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${NEW_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(bridgePayload)
            });

            const data = await res.json();

            if (res.ok) {
                sent++;
                await supabase.from('whatsapp_messages').insert({
                    guest_id: guest.id,
                    event_id: EVENT_ID,
                    phone: phone,
                    status: 'sent',
                    delivery_status: 'bridging',
                    evolution_message_id: data.messages?.[0]?.id,
                    message_phase: 'bridge',
                    category: 'utility',
                    message_text: 'رسالة تمهيدية (جسر العبور)'
                });
                console.log(`✅ [${i+1}/${targetGuests.length}] ${guest.name} (${phone})`);
            } else {
                failed++;
                const errMsg = data.error?.message || 'خطأ';
                await supabase.from('whatsapp_messages').insert({
                    guest_id: guest.id,
                    event_id: EVENT_ID,
                    phone: phone,
                    status: 'failed',
                    error_message: errMsg,
                    message_text: 'فشل إرسال الجسر',
                    message_phase: 'bridge'
                });
                console.log(`❌ [${i+1}/${targetGuests.length}] ${guest.name}: ${errMsg}`);
            }
        } catch (e) {
            failed++;
            console.log(`❌ [${i+1}/${targetGuests.length}] ${guest.name}: ${e.message}`);
        }

        // تأخير 1.5 ثانية بين كل رسالة
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
    console.log(`📌 ملاحظة: لما الضيوف يضغطون "نعم" على الجسر،`);
    console.log(`   الدعوة الكاملة سترسل تلقائياً عبر الـ webhook.`);
}

run();
