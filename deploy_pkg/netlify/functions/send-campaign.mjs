import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

export const handler = async (eventReq, context) => {
    // Only allow POST
    if (eventReq.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(eventReq.body);
    const { guestIds, eventId, campaignType, testPhone } = body;

    let activeStats = { sent: 0, failed: 0, bridged: 0, skipped: 0 };
    let results = [];

    try {

        console.log(`[Pro Engine] 🚀 Starting Synchronous Campaign logic for ${guestIds?.length} guests. Mode: ${campaignType}`);

        if (!guestIds || !eventId) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Missing payload (guestIds or eventId)' }) };
        }

        // --- ENV CHECK ---
        if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Supabase configuration missing on server' }) };
        }
        if (!process.env.META_PHONE_NUMBER_ID || !process.env.META_ACCESS_TOKEN) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Meta API credentials missing on server' }) };
        }

        const supabase = createClient(
            process.env.VITE_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
        );

        console.log(`[Database] Initialized. Service Role: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);

        // 1. Fetch Core Data
        const { data: event, error: eventError } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (eventError || !event) {
            return { statusCode: 404, body: JSON.stringify({ error: `Event not found: ${eventError?.message || ''}` }) };
        }

        const groomName = event.groom_name || event.settings?.groom_name || 'العريس';
        const brideName = event.bride_name || event.settings?.bride_name || 'العروس';
        const eventDate = event.date || 'قريباً';
        const eventTime = event.event_time || event.settings?.event_time || '';
        const displayDate = eventTime ? `${eventDate} الساعة ${eventTime}` : eventDate;
        const eventLocation = event.location || event.location_name || 'الموقع';
        const headerImage = body.headerImage || event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png';
        const templateName = event.template_name || 'get_update';

        // 2. Fetch Targeted Guests
        const { data: guests } = await supabase.from('guests').select('*').in('id', guestIds);
        if (!guests || guests.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Guests not found' }) };
        }

        // ═══════════════════════════════════════════
        // MAIN LOOP
        // ═══════════════════════════════════════════
        for (let i = 0; i < guests.length; i++) {
            const guest = guests[i];

            try {
                // --- PREPARE ---
                let phone = (guest.phone || '').replace(/\D/g, '');
                if (phone.startsWith('05')) phone = '966' + phone.substring(1);
                if (testPhone) phone = testPhone.replace(/\D/g, '');

                if (!phone || phone.length < 9) {
                    activeStats.failed++;
                    results.push({ guestId: guest.id, success: false, error: 'Invalid phone number' });
                    continue;
                }

                // --- DUPLICATE CHECK ---
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { data: sentMsg } = await supabase.from('whatsapp_messages')
                    .select('id')
                    .eq('guest_id', guest.id)
                    .eq('event_id', eventId)
                    .gte('created_at', yesterday)
                    .limit(1)
                    .maybeSingle();

                // Bypass duplicate check if this is a test (testPhone provided) OR it's a reminder
                const isReminder = campaignType?.startsWith('reminder');

                if (sentMsg && !testPhone && !isReminder) {
                    activeStats.skipped++;
                    results.push({ guestId: guest.id, success: false, error: 'Duplicate message within 24h', skipped: true });
                    continue;
                }

                console.log(`[Pro Engine] Processing guest: ${guest.name} (${phone})`);

                // --- BUILD PAYLOAD ---
                const isQR = campaignType === 'qr_code';
                let payload;

                if (isReminder) {
                    // Logic for Reminder (Safe and Isolated)
                    const reminderTemplate = event.settings?.reminder_template_name || 'lony_reminder';
                    payload = {
                        messaging_product: 'whatsapp', to: phone, type: 'template',
                        template: {
                            name: reminderTemplate, language: { code: 'ar' },
                            components: [
                                {
                                    type: 'body', parameters: [
                                        { type: 'text', parameter_name: 'guest_name', text: String(guest.name || 'ضيفنا').trim() },
                                        { type: 'text', parameter_name: 'event_name', text: event.name || 'المناسبة' },
                                        { type: 'text', parameter_name: 'event_date', text: eventDate },
                                        { type: 'text', parameter_name: 'event_location', text: eventLocation }
                                    ]
                                }
                            ]
                        }
                    };
                } else if (isQR) {
                    payload = {
                        messaging_product: 'whatsapp', to: phone, type: 'template',
                        template: {
                            name: 'lony_qr_card', language: { code: 'ar' },
                            components: [{ type: 'body', parameters: [{ type: 'text', text: guest.name }, { type: 'text', text: `https://lonyinvite.netlify.app/check-in.html?id=${guest.id}` }] }]
                        }
                    };
                } else if (templateName.trim() === 'get_update' || true) { // FORCE GET_UPDATE FOR DEBUG
                    // DIRECT LINK PASS-THROUGH - URL-encode coordinates for Meta URL button
                    let mapCoords = encodeURIComponent(event.location_maps_url || eventLocation || 'قاعة الاحتفالات');
                    const personalHeaderImage = headerImage;

                    payload = {
                        messaging_product: 'whatsapp', to: phone, type: 'template',
                        template: {
                            name: 'get_update', language: { code: 'ar' },
                            components: [
                                { type: 'header', parameters: [{ type: 'image', image: { link: personalHeaderImage } }] },
                                {
                                    type: 'body', parameters: [
                                        { type: 'text', parameter_name: 'guest_name', text: String(guest.name || 'ضيفنا').trim() },
                                        { type: 'text', parameter_name: 'groom_name', text: groomName },
                                        { type: 'text', parameter_name: 'bride_name', text: brideName },
                                        { type: 'text', parameter_name: 'event_date', text: displayDate },
                                        { type: 'text', parameter_name: 'event_location', text: eventLocation }
                                    ]
                                },
                                { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                                { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                                { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: mapCoords }] }
                            ]
                        }
                    };
                    console.log(`[Meta Debug] Sending get_update to ${phone}:`, JSON.stringify(payload, null, 2));
                } else {
                    payload = {
                        messaging_product: 'whatsapp', to: phone, type: 'template',
                        template: {
                            name: templateName, language: { code: 'ar' },
                            components: [
                                { type: 'header', parameters: [{ type: 'image', image: { link: headerImage } }] },
                                {
                                    type: 'body', parameters: [
                                        { type: 'text', parameter_name: 'guest_name', text: String(guest.name || 'ضيفنا').trim() },
                                        { type: 'text', parameter_name: 'bride_name', text: brideName },
                                        { type: 'text', parameter_name: 'groom_name', text: groomName },
                                        { type: 'text', parameter_name: 'event_date', text: eventDate },
                                        { type: 'text', parameter_name: 'event_location', text: eventLocation }
                                    ]
                                },
                                { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                                { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] }
                            ]
                        }
                    };
                }

                // --- EXECUTE ---
                const metaRes = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const metaData = await metaRes.json();
                console.log(`[Meta Response] Status: ${metaRes.status}`, JSON.stringify(metaData, null, 2));

                if (metaRes.ok) {
                    activeStats.sent++;
                    const { error: insertError } = await supabase.from('whatsapp_messages').insert([{
                        guest_id: guest.id,
                        event_id: eventId,
                        phone: phone,
                        status: 'sent',
                        delivery_status: 'sent',
                        evolution_message_id: metaData.messages?.[0]?.id,
                        message_phase: isReminder ? 'reminder' : (isQR ? 'qr_code' : 'invitation'),
                        message_text: isReminder ? 'تذكير' : (isQR ? 'بطاقة دخول' : 'دعوة رسمية')
                    }]);

                    if (insertError) {
                        console.error(`[DB Error] Failed to log message for ${guest.name}:`, insertError);
                        // LOG ERROR TO WEBHOOK LOGS FOR VISIBILITY
                        await supabase.from('webhook_debug_logs').insert([{
                            payload: {
                                error: 'DB_INSERT_FAILED',
                                detail: insertError,
                                guest_id: guest.id,
                                guest_name: guest.name
                            }
                        }]);
                    } else {
                        console.log(`[DB Success] Logged message ID ${metaData.messages?.[0]?.id} for ${guest.name}`);
                    }

                    await supabase.from('guests').update({ status: 'sent' }).eq('id', guest.id);
                    results.push({ guestId: guest.id, success: true, bridged: false });

                } else {
                    console.error('[Meta API Error Detail]:', JSON.stringify(metaData, null, 2));
                    const errorCode = metaData.error?.code;

                    // ═══════════════════════════════════════════
                    // SMART RECOVERY (BRIDGE)
                    // ═══════════════════════════════════════════
                    if (errorCode === 131049) {
                        console.log(`🌉 [Bridge] Marketing blocked for ${guest.name}. Sending Utility...`);
                        activeStats.bridged++;

                        // 1. Stash Marketing
                        await supabase.from('guests').update({ status: 'bridging', pending_marketing_data: payload }).eq('id', guest.id);

                        // 2. Send Bridge (Utility)
                        const bridgePayload = {
                            messaging_product: 'whatsapp', to: phone, type: 'template',
                            template: {
                                name: 'lony_invite_bridge', language: { code: 'ar' },
                                components: [{ type: 'body', parameters: [{ type: 'text', text: guest.name }, { type: 'text', text: groomName }] }]
                            }
                        };
                        const bRes = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(bridgePayload)
                        });
                        const bData = await bRes.json();

                        if (bRes.ok) {
                            await supabase.from('whatsapp_messages').insert({
                                guest_id: guest.id, event_id: eventId, status: 'sent', delivery_status: 'bridging',
                                wa_id: bData.messages?.[0]?.id, message_phase: 'bridge', category: 'utility'
                            });
                            results.push({ guestId: guest.id, success: true, bridged: true });
                        } else {
                            activeStats.failed++;
                            await supabase.from('whatsapp_messages').insert({ guest_id: guest.id, event_id: eventId, status: 'failed', error_message: bData.error?.message });
                            results.push({ guestId: guest.id, success: false, error: bData.error?.message, bridged: false });
                        }

                    } else {
                        activeStats.failed++;
                        const errorMsg = metaData.error?.message || 'Unknown Meta Error';
                        await supabase.from('whatsapp_messages').insert({ guest_id: guest.id, event_id: eventId, status: 'failed', error_message: errorMsg });
                        results.push({ guestId: guest.id, success: false, error: errorMsg });
                    }
                }
            } catch (e) {
                console.error(`❌ Error for ${guest.name}:`, e.message);
                await supabase.from('whatsapp_messages').insert({ guest_id: guest.id, event_id: eventId, status: 'failed', error_message: e.message });
                results.push({ guestId: guest.id, success: false, error: e.message });
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                stats: activeStats,
                results: results
            })
        };

    } catch (err) {
        console.error('[Cloud Engine] 🚨 FATAL:', err.message);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.message })
        };
    }
};
