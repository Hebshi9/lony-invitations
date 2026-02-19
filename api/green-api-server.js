/**
 * ══════════════════════════════════════════════════════════
 *  Lony Invitations — WhatsApp Server (Green API Edition)
 *  بديل Baileys — لا مشاكل Pairing — لا فيسبوك
 * ══════════════════════════════════════════════════════════
 *
 *  الإعداد:
 *  1. سجل في https://console.green-api.com/auth/register
 *  2. أنشئ Instance وامسح QR بتطبيق واتساب عادي
 *  3. أضف في .env:
 *     GREEN_API_ID=your_instance_id
 *     GREEN_API_TOKEN=your_api_token
 *
 *  تشغيل: node api/green-api-server.js
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Supabase ───────────────────────────────────────────────
const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// ── Green API Config ───────────────────────────────────────
const G_ID = process.env.GREEN_API_ID;
const G_TOKEN = process.env.GREEN_API_TOKEN;
const G_BASE = `https://api.green-api.com/waInstance${G_ID}`;

// ── Helper: send text message ──────────────────────────────
async function sendText(phone, message) {
    // Green API phone format: 966501234567  (no + or spaces)
    const chatId = phone.replace(/[^0-9]/g, '') + '@c.us';

    const res = await fetch(`${G_BASE}/sendMessage/${G_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Green API error: ${res.status} — ${err}`);
    }

    const data = await res.json();
    console.log(`[Green] ✅ Text sent to ${phone} → idMessage: ${data.idMessage}`);
    return data;
}

// ── Helper: send image with caption ───────────────────────
async function sendImage(phone, imageUrl, caption = '') {
    const chatId = phone.replace(/[^0-9]/g, '') + '@c.us';

    const res = await fetch(`${G_BASE}/sendFileByUrl/${G_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chatId,
            urlFile: imageUrl,
            fileName: 'card.jpg',
            caption
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Green API image error: ${res.status} — ${err}`);
    }

    const data = await res.json();
    console.log(`[Green] ✅ Image sent to ${phone} → idMessage: ${data.idMessage}`);
    return data;
}

// ── Helper: send message (auto detect text vs image) ──────
async function sendMessage(phone, text, imageUrl = null) {
    if (imageUrl) {
        return await sendImage(phone, imageUrl, text);
    }
    return await sendText(phone, text);
}

// ── Helper: get instance status ───────────────────────────
async function getStatus() {
    const res = await fetch(`${G_BASE}/getStateInstance/${G_TOKEN}`);
    if (!res.ok) throw new Error('Failed to get status');
    return await res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
//  API ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// ── Status Check ──────────────────────────────────────────
app.get('/api/whatsapp/status', async (req, res) => {
    if (!G_ID || !G_TOKEN) {
        return res.json({
            success: false,
            connected: false,
            error: 'GREEN_API_ID أو GREEN_API_TOKEN غير موجود في .env'
        });
    }

    try {
        const state = await getStatus();
        res.json({
            success: true,
            connected: state.stateInstance === 'authorized',
            state: state.stateInstance,
            instanceId: G_ID
        });
    } catch (err) {
        res.json({ success: false, connected: false, error: err.message });
    }
});

// ── QR Code (for connecting number) ───────────────────────
app.get('/api/whatsapp/qr', async (req, res) => {
    try {
        const r = await fetch(`${G_BASE}/qr/${G_TOKEN}`);
        const data = await r.json();
        res.json({ success: true, qr: data.message, type: data.type });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ── Accounts (compatibility with old UI) ──────────────────
app.get('/api/whatsapp/accounts', async (req, res) => {
    try {
        const state = await getStatus();
        const isConnected = state.stateInstance === 'authorized';

        // Return single virtual account from Green API
        const accounts = [{
            id: G_ID || 'green-api',
            name: 'Green API (واتساب)',
            phone: isConnected ? 'متصل ✅' : 'غير متصل ❌',
            status: isConnected ? 'connected' : 'disconnected',
            provider: 'green-api'
        }];

        res.json({ accounts });
    } catch {
        res.json({ accounts: [] });
    }
});

// ── Send Single Message ────────────────────────────────────
app.post('/api/whatsapp/send', async (req, res) => {
    const { phone, message, imageUrl } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'phone و message مطلوبان' });
    }

    try {
        const result = await sendMessage(phone, message, imageUrl);
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[Green] ❌ Send error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Prepare Messages (queue to whatsapp_messages table) ───
app.post('/api/whatsapp/prepare-messages', async (req, res) => {
    const { eventId, template, messagePhase = 'invite', filters = {} } = req.body;

    if (!eventId) return res.status(400).json({ error: 'eventId مطلوب' });

    try {
        // Fetch event info
        const { data: event } = await supabase
            .from('events')
            .select('id, name, date, venue')
            .eq('id', eventId)
            .single();

        if (!event) return res.status(404).json({ error: 'الحدث غير موجود' });

        // Build guest query
        let query = supabase
            .from('guests')
            .select('id, name, phone, status, card_image_url, qr_token')
            .eq('event_id', eventId)
            .not('phone', 'is', null);

        // Apply status filter
        if (filters.status && filters.status !== 'all') {
            query = query.eq('status', filters.status);
        }

        const { data: guests, error } = await query;
        if (error) throw error;

        // Build messages
        const messages = guests.map(guest => {
            // Replace template variables
            const msgText = (template || '')
                .replace(/\{\{name\}\}/g, guest.name || '')
                .replace(/\{\{event_name\}\}/g, event.name || '')
                .replace(/\{\{date\}\}/g, event.date || '')
                .replace(/\{\{venue\}\}/g, event.venue || '');

            return {
                event_id: eventId,
                guest_id: guest.id,
                phone: guest.phone,
                message_text: msgText,
                image_url: messagePhase === 'qr_code' ? guest.card_image_url : null,
                message_phase: messagePhase,
                status: 'pending'
            };
        });

        // Insert messages (skip duplicates by resetting pending ones)
        if (messages.length > 0) {
            // Delete old pending messages for same phase to avoid duplicates
            await supabase
                .from('whatsapp_messages')
                .delete()
                .eq('event_id', eventId)
                .eq('message_phase', messagePhase)
                .eq('status', 'pending');

            const { error: insertError } = await supabase
                .from('whatsapp_messages')
                .insert(messages);

            if (insertError) throw insertError;
        }

        res.json({ success: true, count: messages.length, eventName: event.name });

    } catch (err) {
        console.error('[Green] ❌ Prepare error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ── Send Batch ─────────────────────────────────────────────
// Sends all pending messages for an event from the DB queue
app.post('/api/whatsapp/send-batch', async (req, res) => {
    const { eventId, delayMs = 3000 } = req.body;

    if (!eventId) return res.status(400).json({ error: 'eventId مطلوب' });

    // Fetch pending messages
    const { data: pendingMsgs, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    if (!pendingMsgs || pendingMsgs.length === 0) {
        return res.json({ success: true, sent: 0, message: 'لا توجد رسائل معلقة' });
    }

    // Respond immediately — process in background
    res.json({ success: true, total: pendingMsgs.length, message: 'بدأ الإرسال في الخلفية...' });

    // Background sending with delay between messages (avoid spam detection)
    (async () => {
        let sentCount = 0;
        let failCount = 0;

        for (const msg of pendingMsgs) {
            try {
                await sendMessage(msg.phone, msg.message_text, msg.image_url || null);

                await supabase.from('whatsapp_messages').update({
                    status: 'sent',
                    sent_at: new Date().toISOString()
                }).eq('id', msg.id);

                sentCount++;
                console.log(`[Green] 📤 ${sentCount}/${pendingMsgs.length} — ${msg.phone}`);
            } catch (err) {
                console.error(`[Green] ❌ Failed ${msg.phone}:`, err.message);

                await supabase.from('whatsapp_messages').update({
                    status: 'failed',
                    error_message: err.message
                }).eq('id', msg.id);

                failCount++;
            }

            // Delay between messages (important!)
            if (delayMs > 0) {
                await new Promise(r => setTimeout(r, delayMs));
            }
        }

        console.log(`[Green] ✅ Batch done — Sent: ${sentCount}, Failed: ${failCount}`);
    })();
});

// ── Batch Status ───────────────────────────────────────────
app.get('/api/whatsapp/status/:eventId', async (req, res) => {
    const { eventId } = req.params;

    const { data } = await supabase
        .from('whatsapp_messages')
        .select('status')
        .eq('event_id', eventId);

    const stats = {
        total: data?.length || 0,
        pending: data?.filter(m => m.status === 'pending').length || 0,
        sent: data?.filter(m => m.status === 'sent').length || 0,
        failed: data?.filter(m => m.status === 'failed').length || 0,
    };

    res.json({
        success: true,
        status: {
            stats,
            isRunning: stats.pending > 0
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
//  WEBHOOK — Incoming messages from Green API
//  اضبط في لوحة Green API: Webhook URL = http://your-server:3001/api/whatsapp/webhook
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/whatsapp/webhook', async (req, res) => {
    res.sendStatus(200); // Acknowledge immediately

    const body = req.body;

    // Only process incoming text messages
    if (body.typeWebhook !== 'incomingMessageReceived') return;

    const senderData = body.senderData;
    const msgData = body.messageData;

    // Skip groups and non-text
    if (!senderData || senderData.chatId?.includes('@g.us')) return;

    const rawPhone = senderData.chatId?.replace('@c.us', '') || '';
    const phone = '+' + rawPhone;
    const messageText = msgData?.textMessageData?.textMessage || '';

    if (!phone || !messageText) return;

    console.log(`[Green Webhook] 📨 From ${phone}: "${messageText}"`);

    try {
        // ── 1. Identify Guest ──────────────────────────────
        const { data: potentialGuests } = await supabase
            .from('guests')
            .select('id, name, event_id, status, card_image_url, qr_token')
            .eq('phone', phone);

        let guest = null;

        if (potentialGuests && potentialGuests.length > 0) {
            if (potentialGuests.length === 1) {
                guest = potentialGuests[0];
            } else {
                // Multiple guests (same phone in different events) → use latest message
                const { data: lastMsg } = await supabase
                    .from('whatsapp_messages')
                    .select('event_id, guest_id')
                    .eq('phone', phone)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (lastMsg) {
                    guest = potentialGuests.find(g =>
                        g.id === lastMsg.guest_id && g.event_id === lastMsg.event_id
                    );
                }
                if (!guest) guest = potentialGuests[0];
            }
        }

        if (guest) {
            // ── 2. RSVP Processing ─────────────────────────
            console.log(`[Webhook] 👤 Guest: ${guest.name}`);

            // Simple keyword detection (no AI dependency)
            const lower = messageText.toLowerCase();
            const confirmedKw = ['نعم', 'أكيد', 'موافق', 'حاضر', 'yes', 'ok', 'تمام', 'ان شاء الله', 'إن شاء الله', 'اوكي', 'confirm'];
            const declinedKw = ['لا', 'اعتذر', 'ما أقدر', 'no', 'sorry', 'مشغول', 'ما اقدر', 'معذرة', 'decline'];
            const maybeKw = ['ممكن', 'غير متأكد', 'maybe', 'not sure', 'مو متأكد', 'ما ادري'];

            let rsvpStatus = null;
            if (confirmedKw.some(k => lower.includes(k))) rsvpStatus = 'confirmed';
            else if (declinedKw.some(k => lower.includes(k))) rsvpStatus = 'declined';
            else if (maybeKw.some(k => lower.includes(k))) rsvpStatus = 'maybe';

            if (rsvpStatus) {
                console.log(`[Webhook] ✅ RSVP: ${guest.name} → ${rsvpStatus}`);

                // Update guest status
                await supabase.from('guests').update({
                    status: rsvpStatus,
                    rsvp_at: new Date().toISOString()
                }).eq('id', guest.id);

                // Log reply
                await supabase.from('whatsapp_replies').insert({
                    guest_id: guest.id,
                    event_id: guest.event_id,
                    phone,
                    reply_text: messageText,
                    is_rsvp: true,
                    rsvp_response: rsvpStatus
                }).catch(() => { }); // Ignore if table doesn't exist

                // Auto-send card if confirmed
                if (rsvpStatus === 'confirmed' && guest.card_image_url) {
                    // Check not already sent
                    const { data: existing } = await supabase
                        .from('whatsapp_messages')
                        .select('id')
                        .eq('guest_id', guest.id)
                        .eq('message_phase', 'qr_code')
                        .in('status', ['sent', 'delivered', 'read'])
                        .maybeSingle();

                    if (!existing) {
                        const verifyLink = `${process.env.VITE_APP_URL || 'https://your-app.com'}/verify/${guest.qr_token}`;
                        const cardMsg = `شكراً لتأكيد حضورك يا ${guest.name} 🌹\n\nهذا كرت الدخول الخاص بك:\n${verifyLink}\n\nاحتفظ به وأحضره معك يوم المناسبة.`;

                        try {
                            await sendImage(phone, guest.card_image_url, cardMsg);
                            console.log(`[Webhook] 🃏 Card auto-sent to ${guest.name}`);

                            await supabase.from('whatsapp_messages').insert({
                                event_id: guest.event_id,
                                guest_id: guest.id,
                                phone,
                                message_text: cardMsg,
                                image_url: guest.card_image_url,
                                message_phase: 'qr_code',
                                status: 'sent',
                                sent_at: new Date().toISOString()
                            });
                        } catch (e) {
                            console.error('[Webhook] ❌ Card send failed:', e.message);
                        }
                    }
                }

                // Send confirmation reply
                const replies = {
                    confirmed: `شكراً لتأكيد حضورك يا ${guest.name} 🎉`,
                    declined: `نأسف لعدم تمكنك من الحضور يا ${guest.name} 😔`,
                    maybe: `شكراً، نأمل نراك ${guest.name} 🙏`
                };
                await sendText(phone, replies[rsvpStatus]).catch(() => { });
            }

        } else {
            // ── 3. Sales AI (non-guest) ────────────────────
            console.log(`[Webhook] 🤖 Unknown number ${phone} — Sales AI`);

            try {
                // Import Sales AI dynamically
                const { default: lonySalesAI } = await import('../src/services/lony-sales-ai.js');

                let { data: conversation } = await supabase
                    .from('sales_conversations')
                    .select('*')
                    .eq('phone', phone)
                    .eq('status', 'active')
                    .maybeSingle();

                if (!conversation) {
                    const { data: newConv } = await supabase
                        .from('sales_conversations')
                        .insert({ phone, status: 'active', message_count: 0 })
                        .select().single();
                    conversation = newConv;
                }

                const aiResult = await lonySalesAI.generateResponse(messageText);

                await supabase.from('sales_messages').insert([
                    { conversation_id: conversation.id, direction: 'incoming', sender_phone: phone, message_text: messageText },
                    { conversation_id: conversation.id, direction: 'outgoing', message_text: aiResult.response, ai_response: aiResult.response, ai_intent: aiResult.intent }
                ]);

                await sendText(phone, aiResult.response);

                // Escalation
                if (aiResult.intent === 'escalation' || aiResult.priority === 'high') {
                    const ADMIN = process.env.ADMIN_PHONE;
                    if (ADMIN) {
                        const summary = `🚨 تصعيد Sales AI\n📱 ${phone}\n🎯 ${aiResult.intent}\n\n💬 "${messageText}"\n\n🤖 "${aiResult.response}"`;
                        await sendText(ADMIN, summary).catch(() => { });
                        console.log(`[Webhook] 🚨 Escalated to ${ADMIN}`);
                    }
                }
            } catch (aiErr) {
                console.error('[Webhook] Sales AI error:', aiErr.message);
            }
        }

    } catch (err) {
        console.error('[Webhook] ❌ Error:', err.message);
    }
});

// ── Health Check ───────────────────────────────────────────
app.get('/api/whatsapp/ping', (req, res) => res.json({ ok: true, provider: 'green-api', time: new Date().toISOString() }));

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🟢 ════════════════════════════════════════════`);
    console.log(`   Lony WhatsApp Server — Green API`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Instance: ${G_ID || '⚠️  لم يُضبط GREEN_API_ID'}`);
    console.log(`   Status:   ${G_ID && G_TOKEN ? '✅ مُهيأ' : '❌ أضف .env variables'}`);
    console.log(`════════════════════════════════════════════\n`);

    if (!G_ID || !G_TOKEN) {
        console.warn('⚠️  أضف هذه المتغيرات في ملف .env:');
        console.warn('   GREEN_API_ID=xxxxxx');
        console.warn('   GREEN_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx\n');
    }
});
