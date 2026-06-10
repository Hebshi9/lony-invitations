import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const NEW_TOKEN = 'EAAV4hiaLibsBRn4mCPQ8sxJEyY5rXUaQ8xJhDuyBxVwkTnEx1ZArMK2YTZBuNROKsy0NBNUUUZBX77WrZAFfYMdMItbY7y5ESIwtS8KVwkpuhIq727wfmhC5biAWVuh6tbDkZAbNhFAc0yq0jZCCNebdZACCkZCOC76BzJZCa4Dwr4F7e0hIHZAI9rjdcPpVGJZAZBFEYrUPAYM2y5wDAk2REfWOgeEKrH6KvBQmufpbE6D36MOlFDG1TH3ZBWGB0PxyoCPuBr7ijZBuvFMOEiGOhEUsJaYITD';
const PHONE_ID = '1031606736708015';

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'e5c16571-e50c-4ff3-ab76-259813717c62';
const GUEST_ID = 'b6788ed5-ae00-44fe-aa96-a2414597e9f5'; // سارة
const GUEST_PHONE = '966507240097';
const GUEST_NAME = 'سارة';

async function run() {
    // Fetch event for invitation payload
    const { data: event } = await supabase.from('events').select('*').eq('id', EVENT_ID).single();
    
    const groomName = event.groom_name || event.settings?.groom_name || 'العريس';
    const brideName = event.bride_name || event.settings?.bride_name || 'العروس';
    const eventDate = event.date || 'قريباً';
    const eventLocation = event.location || 'الموقع';
    const headerImage = event.settings?.global_invite_image_url;
    let templateName = event.template_name || 'get_update';
    if (templateName === 'lony') templateName = 'get_update';
    const mapCoords = encodeURIComponent(event.location_maps_url || eventLocation);
    const familyName = event.settings?.family_name || event.name || 'زفافنا العزيز';

    // 1. Build the invitation payload (to stash for after bridge approval)
    const invitationPayload = {
        messaging_product: 'whatsapp', to: GUEST_PHONE, type: 'template',
        template: {
            name: templateName, language: { code: 'ar' },
            components: [
                { type: 'header', parameters: [{ type: 'image', image: { link: headerImage } }] },
                { type: 'body', parameters: [
                    { type: 'text', parameter_name: 'guest_name', text: GUEST_NAME },
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

    // Stash invitation payload in guest record
    console.log('📦 حفظ الدعوة المعلقة في سجل الضيف...');
    await supabase.from('guests').update({ 
        pending_marketing_data: invitationPayload,
        status: 'bridging'
    }).eq('id', GUEST_ID);

    // 2. Send Bridge message (Utility template)
    const bridgePayload = {
        messaging_product: 'whatsapp', to: GUEST_PHONE, type: 'template',
        template: {
            name: 'lony_invite_bridge', language: { code: 'ar' },
            components: [{
                type: 'body',
                parameters: [
                    { type: 'text', parameter_name: 'guest_name', text: GUEST_NAME },
                    { type: 'text', parameter_name: 'sender_name', text: `زفاف ${familyName}` }
                ]
            }]
        }
    };

    console.log(`🌉 إرسال رسالة جسر العبور لـ ${GUEST_NAME} (${GUEST_PHONE})...`);

    const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${NEW_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bridgePayload)
    });

    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (res.ok) {
        // Log to DB
        await supabase.from('whatsapp_messages').insert({
            guest_id: GUEST_ID,
            event_id: EVENT_ID,
            phone: GUEST_PHONE,
            status: 'sent',
            delivery_status: 'bridging',
            evolution_message_id: data.messages?.[0]?.id,
            message_phase: 'bridge',
            category: 'utility',
            message_text: 'رسالة تمهيدية (جسر العبور)'
        });
        console.log('✅ تم الإرسال بنجاح! تحقق من جوال سارة.');
    } else {
        console.log('❌ فشل الإرسال:', data.error?.message);
    }
}

run();
