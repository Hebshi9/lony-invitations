
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req) {
    // 1. WhatsApp Webhook Verification (GET)
    if (req.method === 'GET') {
        const query = new URL(req.url).searchParams;
        if (query.get('hub.mode') === 'subscribe') {
            return new Response(query.get('hub.challenge'), { status: 200 });
        }
    }

    // 2. Process Incoming Events (POST)
    if (req.method === 'POST') {
        try {
            const body = await req.json();
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            // Handle Status Updates (Sent, Delivered, Read)
            if (value?.statuses) {
                const status = value.statuses[0];
                const messageId = status.id;
                const deliveryStatus = status.status; // 'delivered' or 'read'

                await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_messages?meta_message_id=eq.${messageId}`, {
                    method: 'PATCH',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ delivery_status: deliveryStatus })
                });
            }

            // Handle Button Responses (RSVP)
            if (value?.messages) {
                const message = value.messages[0];
                if (message.type === 'button') {
                    const payload = message.button.payload; // 'CONFIRM' or 'DECLINE'
                    const from = message.from; // Sender phone

                    // Find guest by phone
                    const guestRes = await fetch(`${SUPABASE_URL}/rest/v1/guests?phone=ilike.%${from.slice(-9)}&select=id,event_id`, {
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                    });
                    const guest = (await guestRes.json())[0];

                    if (guest) {
                        const rsvpStatus = payload === 'CONFIRM' ? 'confirmed' : 'declined';
                        await fetch(`${SUPABASE_URL}/rest/v1/guests?id=eq.${guest.id}`, {
                            method: 'PATCH',
                            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rsvp_status: rsvpStatus, whatsapp_rsvp_status: rsvpStatus, whatsapp_rsvp_at: new Date().toISOString() })
                        });

                        // 🚦 AUTO-RESPONSE: Send QR Code if confirmed
                        if (payload === 'CONFIRM') {
                            console.log(`[Webhook] Sending auto-QR to ${from}`);
                            await fetch(`${process.env.URL}/.netlify/functions/send-final`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    guestIds: [guest.id],
                                    eventId: guest.event_id,
                                    campaignType: 'qr_code',
                                    isAutoResponse: true
                                })
                            });
                        }
                    }
                }
            }

            return new Response(JSON.stringify({ success: true }), { status: 200 });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
    }

    return new Response('Method Not Allowed', { status: 405 });
}
