// Trigger build with new environment variables - 2026-06-09
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

export const handler = async (eventReq, context) => {
    if (eventReq.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const body = JSON.parse(eventReq.body);
    const { guestIds, eventId, campaignType, testPhone } = body;

    if (!guestIds || !eventId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing guestIds or eventId' }) };

    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';
    const META_TOKEN = process.env.META_ACCESS_TOKEN || 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';
    const PHONE_ID = process.env.META_PHONE_NUMBER_ID || '1031606736708015';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Get Event Data
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
    const { data: guests } = await supabase.from('guests').select('*').in('id', guestIds);

    const results = [];
    const groomName = event?.groom_name || 'العريس';

    for (const guest of guests) {
        try {
            let phone = (testPhone || guest.phone || '').replace(/\D/g, '');
            if (phone.startsWith('05')) phone = '966' + phone.substring(1);
            else if (phone.startsWith('5') && phone.length === 9) phone = '966' + phone;
            else if (phone.length === 10 && phone.startsWith('05')) phone = '966' + phone.substring(1);

            const eventLocation = event.location || event.location_name || 'الموقع';
            let templateName = event.template_name || 'get_update';
            if (templateName === 'lony') templateName = 'get_update';
            const headerImage = body.headerImage || event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png';
            const mapCoords = encodeURIComponent(event.location_maps_url || eventLocation || 'قاعة الاحتفالات');

            let bodyParams = [];
            if (templateName === 'lony_generic') {
                bodyParams = [
                    { type: 'text', parameter_name: 'guest_name', text: guest.name },
                    { type: 'text', parameter_name: 'event_name', text: event.name || 'المناسبة' },
                    { type: 'text', parameter_name: 'event_date', text: event.date || 'اليوم' },
                    { type: 'text', parameter_name: 'event_location', text: eventLocation },
                    { type: 'text', parameter_name: 'note', text: event.settings?.note || 'نتمنى حضوركم' }
                ];
            } else {
                bodyParams = [
                    { type: 'text', parameter_name: 'guest_name', text: guest.name }, 
                    { type: 'text', parameter_name: 'groom_name', text: groomName }, 
                    { type: 'text', parameter_name: 'bride_name', text: event.bride_name || 'العروس' }, 
                    { type: 'text', parameter_name: 'event_date', text: event.date || 'اليوم' }, 
                    { type: 'text', parameter_name: 'event_location', text: eventLocation }
                ];
            }

            let payload;
            if (campaignType === 'manual_bridge') {
                        // Store the invitation payload in guests table so the webhook knows what to send after bridge approval
                        const invitationPayload = {
                            messaging_product: 'whatsapp', to: phone, type: 'template',
                            template: {
                                name: templateName, language: { code: 'ar' },
                                components: [
                                    { type: 'header', parameters: [{ type: 'image', image: { link: headerImage } }] },
                                    { type: 'body', parameters: bodyParams },
                                    { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                                    { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                                    { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: mapCoords }] }
                                ]
                            }
                        };
                        await supabase.from('guests').update({ pending_marketing_data: invitationPayload }).eq('id', guest.id);

                        payload = {
                            messaging_product: 'whatsapp', to: phone, type: 'template',
                            template: {
                                name: 'lony_invite_bridge', language: { code: 'ar' },
                                components: [{ 
                                    type: 'body', 
                                    parameters: [
                                        { type: 'text', parameter_name: 'guest_name', text: guest.name }, 
                                        { type: 'text', parameter_name: 'sender_name', text: event.settings?.family_name ? `زفاف آل ${event.settings.family_name}` : (event.name || 'زفافنا العزيز') }
                                    ] 
                                }]
                            }
                        };
            } else {
                payload = {
                    messaging_product: 'whatsapp', to: phone, type: 'template',
                    template: {
                        name: templateName, language: { code: 'ar' },
                        components: [
                            { type: 'header', parameters: [{ type: 'image', image: { link: headerImage } }] },
                            { type: 'body', parameters: bodyParams },
                            { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                            { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                            { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: mapCoords }] }
                        ]
                    }
                };
            }

            console.log(`[send-batch-v2] campaignType=${campaignType} | template=${payload?.template?.name} | to=${phone}`);

            const metaRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const metaData = await metaRes.json();
            if (metaRes.ok) {
                const status = campaignType === 'manual_bridge' ? 'bridging' : 'sent';
                await supabase.from('whatsapp_messages').insert({
                    guest_id: guest.id, 
                    event_id: eventId, 
                    phone: phone, 
                    status: 'sent', 
                    evolution_message_id: metaData.messages?.[0]?.id,
                    message_phase: campaignType === 'manual_bridge' ? 'bridge' : 'invitation',
                    message_text: campaignType === 'manual_bridge' ? 'رسالة تمهيدية (جسر العبور)' : 'دعوة رسمية'
                });
                await supabase.from('guests').update({ status }).eq('id', guest.id);
                results.push({ guestId: guest.id, success: true });
            } else {
                const errorMsg = metaData.error?.message || 'Meta Error';
                await supabase.from('whatsapp_messages').insert({ guest_id: guest.id, event_id: eventId, phone: phone, status: 'failed', error_message: errorMsg });
                await supabase.from('guests').update({ status: 'failed' }).eq('id', guest.id);
                results.push({ guestId: guest.id, success: false, error: errorMsg });
            }
        } catch (e) {
            results.push({ guestId: guest.id, success: false, error: e.message });
        }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, results }) };
};
