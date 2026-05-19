
export const handler = async (event, context) => {
    const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body);
        const { guestIds, eventId, campaignType } = body;

        // Fetch Event
        const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=*`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const eventData = (await eventRes.json())[0];

        // Fetch Guests
        const guestIdsString = guestIds.map(id => `"${id}"`).join(',');
        const guestsRes = await fetch(`${SUPABASE_URL}/rest/v1/guests?id=in.(${guestIdsString})&select=*`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const guests = await guestsRes.json();

        const results = [];
        for (const guest of guests) {
            try {
                let phone = guest.phone.replace(/\D/g, '');
                if (phone.startsWith('05')) phone = '966' + phone.substring(1);
                else if (phone.startsWith('5') && phone.length === 9) phone = '966' + phone;

                // --- Campaign Logic Routing ---
                const isQR = campaignType === 'qr_code';
                const templateName = isQR ? 'lony_qr' : 'lony'; // Assuming lony_qr for QR cards, fallback to lony if needed
                
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
                                parameters: [{
                                    type: 'image',
                                    image: { 
                                        link: isQR 
                                            ? (guest.card_image_url || 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/sample_qr.png')
                                            : (eventData.settings?.global_invite_image_url || 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/sample_invite.jpg')
                                    }
                                }]
                            },
                            {
                                type: 'body',
                                parameters: isQR ? [
                                    { type: 'text', text: guest.name || 'ضيفنا العزيز' },
                                    { type: 'text', text: eventData.settings?.bride_name || 'العروس' },
                                    { type: 'text', text: eventData.settings?.groom_name || 'العريس' },
                                    { type: 'text', text: guest.table_no || 'لم يحدد' },
                                    { type: 'text', text: guest.category || 'عام' }
                                ] : [
                                    { type: 'text', text: guest.name || 'ضيفنا العزيز' },
                                    { type: 'text', text: eventData.settings?.bride_name || 'العروس' },
                                    { type: 'text', text: eventData.settings?.groom_name || 'العريس' },
                                    { type: 'text', text: eventData.date || 'اليوم' },
                                    { type: 'text', text: eventData.location || 'الموقع' }
                                ]
                            }
                        ]
                    }
                };

                // Add buttons for Invitation mode
                if (!isQR) {
                    payload.template.components.push(
                        { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                        { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] }
                    );
                }

                const metaRes = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const metaResp = await metaRes.json();

                if (metaResp.messages) {
                    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_messages`, {
                        method: 'POST',
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            guest_id: guest.id,
                            event_id: eventId,
                            evolution_message_id: metaResp.messages[0].id,
                            status: 'sent',
                            delivery_status: 'sent',
                            message_phase: campaignType === 'invite' ? 'invitation' : 'qr_code'
                        })
                    });
                    results.push({ guestId: guest.id, success: true });
                } else {
                    results.push({ guestId: guest.id, success: false, error: metaResp.error?.message });
                }
            } catch (e) {
                results.push({ guestId: guest.id, success: false, error: e.message });
            }
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results })
        };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
