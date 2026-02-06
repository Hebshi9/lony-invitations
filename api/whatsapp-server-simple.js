// Evolution API Adapter Server
import { createRequire } from "module";
const require = createRequire(import.meta.url);

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import lonySalesAI from '../src/services/lony-sales-ai.js';
import rsvpAI from '../src/services/rsvp-ai-service.js';
import { fillTemplate, getTemplateVariables } from '../src/services/message-templates.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection:', reason);
});

const EVOLUTION_URL = process.env.EVOLUTION_URL || 'http://localhost:8081';
// This API Key must match what we set in docker-compose
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '429683C4C977415CAAFCCE10F7D57E11';

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// Initialize Supabase
const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// Initialize Gemini
let genAIModel = null;
if (process.env.VITE_GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
        genAIModel = genAI.getGenerativeModel({ model: 'gemini-pro' });
        console.log('✨ Gemini AI Initialized');
    } catch (e) {
        console.error('❌ Failed to initialize Gemini:', e);
    }
}

// Job State Management
let jobState = {
    isRunning: false,
    isPaused: false,
    eventId: null,
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
    lastLog: '',
    shouldStop: false // signal to stop
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getSpeedDelay = (mode) => {
    switch (mode) {
        case 'fast': return 2000;      // 2 sec (safer than 1)
        case 'balanced': return 5000;  // 5 sec
        case 'safe': return 10000;     // 10 sec
        default: return 5000;
    }
};

// --- Evolution API Helpers ---

const evoHeaders = {
    'Content-Type': 'application/json',
    'apikey': EVOLUTION_API_KEY
};

async function callEvolution(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: evoHeaders
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(`${EVOLUTION_URL}${endpoint}`, options);
        // Handle non-JSON responses from Evolution (sometimes happens on error)
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error(`Evolution API Response Error (${endpoint}): Not JSON`, text.substring(0, 100));
            return { error: 'Invalid JSON from Evolution', raw: text };
        }
    } catch (error) {
        console.error(`Evolution API Error (${endpoint}):`, error.message);
        return { error: error.message };
    }
}

// --- Routes ---

app.get('/', (req, res) => {
    res.json({
        status: 'running',
        backend: 'Evolution API Adapter',
        message: '🚀 Lony WhatsApp Server (Evolution Edition)'
    });
});

// Account Management (Database)
app.get('/api/whatsapp/accounts', async (req, res) => {
    try {
        console.log('🔍 Fetching accounts...');
        // Try fetching from DB with timeout
        const dbPromise = supabase
            .from('whatsapp_accounts')
            .select('*')
            .order('created_at', { ascending: false });

        // Timeout after 3 seconds for DB
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ error: { message: 'DB Timeout' } }), 3000));

        // Race DB against timeout
        const result = await Promise.race([dbPromise, timeoutPromise]);
        const { data, error } = result || {};

        if (error) console.error('DB fetch error/timeout:', error.message);

        let accountsToProcess = data || [];

        // FALLBACK: Inject Admin Account if missing or error
        const adminPhone = process.env.ADMIN_PHONE || '+966503678789';
        const adminId = adminPhone.replace(/[^0-9]/g, '');

        // Normalize IDs for comparison
        if (!accountsToProcess.some(a => a.id.toString() === adminId)) {
            console.log('⚠️ Using Fallback Account (DB error/missing/slow)');
            accountsToProcess.push({
                id: adminId,
                phone: adminId,
                name: 'رقم الإدارة (System)',
                status: 'disconnected',
                daily_limit: 1000,
                connected: false,
                is_active: true
            });
        }

        // Check status with Evolution for each account
        const accountsWithStatus = await Promise.all(accountsToProcess.map(async acc => {
            try {
                // Check if instance is connected
                const state = await callEvolution(`/instance/connectionState/${acc.id}`);
                const isConnected = state?.instance?.state === 'open';

                return {
                    ...acc,
                    connected: isConnected,
                    status: isConnected ? 'connected' : 'disconnected'
                };
            } catch (err) {
                console.error(`Status check failed for ${acc.id}:`, err.message);
                // Return account anyway, marked as disconnected
                return {
                    ...acc,
                    connected: false,
                    status: 'disconnected',
                    error: 'Status check failed'
                };
            }
        }));

        res.json({ success: true, accounts: accountsWithStatus });
    } catch (error) {
        console.error('Error fetching accounts (CRITICAL):', error);
        // Absolute fail-safe
        const adminId = '966503678789';
        res.json({
            success: true,
            accounts: [{
                id: adminId,
                phone: adminId,
                name: 'رقم الإدارة (Rescue)',
                status: 'disconnected',
                connected: false
            }]
        });
    }
});

app.post('/api/whatsapp/accounts', async (req, res) => {
    try {
        const { phone, name, daily_limit } = req.body;
        // Use a clean ID
        const id = phone.replace(/[^0-9]/g, '');

        // Try to save to DB, but don't fail if DB is slow
        try {
            await supabase
                .from('whatsapp_accounts')
                .upsert([{
                    id: id,
                    phone,
                    name: name || phone,
                    daily_limit: daily_limit || 170,
                    is_active: true
                }]);
        } catch (e) {
            console.error('DB Upsert Error:', e);
        }

        // Create instance in Evolution
        await callEvolution('/instance/create', 'POST', {
            instanceName: id,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
        });

        res.json({ success: true, account: { id, phone, name } });
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/whatsapp/accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Delete from Evolution
        await callEvolution(`/instance/logout/${id}`, 'DELETE');
        await callEvolution(`/instance/delete/${id}`, 'DELETE');

        // Delete from DB
        await supabase.from('whatsapp_accounts').delete().eq('id', id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Connection & QR
app.post('/api/whatsapp/connect/:accountId', async (req, res) => {
    const { accountId } = req.params;

    // Create/Ensure instance exists
    const createRes = await callEvolution('/instance/create', 'POST', {
        instanceName: accountId,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
    });

    // Invoke connect to trigger QR generation
    const connectRes = await callEvolution(`/instance/connect/${accountId}`, 'GET');

    res.json({ success: true, message: 'Initializing...', debug: connectRes });
});

app.get('/api/whatsapp/qr-status/:accountId', async (req, res) => {
    const { accountId } = req.params;

    // Check connection state
    const stateRes = await callEvolution(`/instance/connectionState/${accountId}`);
    const isConnected = stateRes?.instance?.state === 'open';

    if (isConnected) {
        // Update DB
        try { await supabase.from('whatsapp_accounts').update({ status: 'connected' }).eq('id', accountId); } catch (e) { }
        return res.json({ success: true, connected: true, qr: null });
    }

    // Fetch QR
    const qrRes = await callEvolution(`/instance/connect/${accountId}`);
    // In Evolution V2, qrRes often looks like: { "instance": "...", "base64": "...", "code": "..." }
    const qr = qrRes?.base64 || qrRes?.code || qrRes?.qrcode?.base64 || qrRes?.qrcode?.code;

    res.json({ success: true, connected: false, qr });
});

app.post('/api/whatsapp/disconnect/:accountId', async (req, res) => {
    const { accountId } = req.params;
    await callEvolution(`/instance/logout/${accountId}`, 'DELETE');

    await supabase.from('whatsapp_accounts').update({ status: 'disconnected' }).eq('id', accountId);

    res.json({ success: true });
});

// Webhook handling from Evolution API
app.post('/webhook', async (req, res) => {
    const data = req.body;

    // Check if it's a message upsert
    if (data.event === 'messages.upsert') {
        const msg = data.data;
        const accountId = data.instance;

        console.log(`[Webhook] 🔔 RECEIVED EVENT from ${accountId}`);

        // ALLOW SELF-REPLY EXPERIMENTALLY:
        // if (msg.key?.fromMe) {
        //    console.log('[Webhook] Ignoring message from me');
        //    return res.sendStatus(200);
        // }

        const phone = '+' + (msg.key?.remoteJid?.split('@')[0] || '');
        const messageText = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption || '';

        if (!messageText) return res.sendStatus(200);

        console.log(`[Webhook] 📨 From ${phone}: "${messageText}"`);

        try {
            // 1. Identify Context (Guest or Client)
            // First, find all potential guests with this phone
            const { data: potentialGuests } = await supabase
                .from('guests')
                .select('id, name, event_id, rsvp_status, card_image_url')
                .eq('phone', phone);

            let guest = null;
            let handledAsRSVP = false;

            if (potentialGuests && potentialGuests.length > 0) {
                if (potentialGuests.length === 1) {
                    guest = potentialGuests[0];
                } else {
                    // AMBIGUOUS: Multiple guests with same phone
                    const { data: lastMsg } = await supabase
                        .from('whatsapp_messages')
                        .select('event_id, guest_id')
                        .eq('phone', phone)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (lastMsg) {
                        guest = potentialGuests.find(g => g.id === lastMsg.guest_id && g.event_id === lastMsg.event_id);
                    }
                    if (!guest) guest = potentialGuests[0];
                }

                // --- ATTEMPT RSVP FLOW ---
                if (guest) {
                    console.log(`[Webhook] 👤 Guest identified: ${guest.name}. Checking for RSVP content...`);
                    const analysis = await rsvpAI.analyzeReply(messageText, guest.name);

                    // Only treat as RSVP if confidence is decent OR status is clear
                    // If it's just "chatting" (status=null or low confidence), we fall through to Sales AI
                    if (analysis.is_rsvp || analysis.status || analysis.confidence > 0.6) {
                        handledAsRSVP = true;

                        // Save Reply
                        await supabase.from('whatsapp_replies').insert({
                            guest_id: guest.id,
                            event_id: guest.event_id,
                            phone: phone,
                            reply_text: messageText,
                            is_rsvp: analysis.is_rsvp,
                            rsvp_response: analysis.status,
                            ai_confidence: analysis.confidence
                        });

                        if (analysis.status) {
                            // Update RSVP status
                            await supabase.from('guests').update({
                                rsvp_status: analysis.status,
                                rsvp_at: new Date().toISOString()
                            }).eq('id', guest.id);

                            // Auto-send card if confirmed
                            if (analysis.status === 'confirmed') {
                                if (guest.card_image_url) {
                                    const reply = `شكراً لتأكيد حضورك يا ${guest.name} 🌹\nهذا كرت الدخول الخاص بك. نتشرف بك.`;
                                    await callEvolution(`/message/sendMedia/${accountId}`, 'POST', {
                                        number: msg.key.remoteJid,
                                        mediaMessage: {
                                            mediatype: "image",
                                            caption: reply,
                                            media: guest.card_image_url
                                        }
                                    });
                                } else {
                                    await callEvolution(`/message/sendText/${accountId}`, 'POST', {
                                        number: msg.key.remoteJid,
                                        textMessage: { text: `يا هلا بك يا ${guest.name}، تم تأكيد حضورك. سيتم إرسال الكرت قريباً.` }
                                    });
                                }
                            } else if (analysis.status === 'declined') {
                                await callEvolution(`/message/sendText/${accountId}`, 'POST', {
                                    number: msg.key.remoteJid,
                                    textMessage: { text: `أفأ يا ${guest.name}، مكانك خالي 😔. خيرها بغيرها إن شاء الله.` }
                                });
                            }
                        }
                    } else {
                        console.log(`[Webhook] Message from guest "${messageText}" does not look like RSVP (Confidence: ${analysis.confidence}). Passing to Sales AI.`);
                    }
                }
            }

            if (!handledAsRSVP) {
                // --- SALES AGENT FLOW (Fallback for everyone) ---
                console.log(`[Webhook] 🤖 Processing as General Inquiry / Sales: ${phone}`);

                // 1. Find or create conversation
                let { data: conversation } = await supabase
                    .from('sales_conversations')
                    .select('*')
                    .eq('phone', phone)
                    .eq('status', 'active')
                    .maybeSingle();

                if (!conversation) {
                    const { data: newConv } = await supabase
                        .from('sales_conversations')
                        .insert({
                            phone: phone,
                            status: 'active',
                            message_count: 0,
                            client_name: guest ? guest.name : undefined
                        })
                        .select()
                        .single();
                    conversation = newConv;
                    console.log(`[Sales AI] 🆕 New conversation for ${phone}`);
                }

                // Append guest context if available
                let context = [];
                if (guest) {
                    context.push({
                        role: "system",
                        content: `User Context: This user is already a guest named "${guest.name}" invited to event ID ${guest.event_id}. Treat them warmly as an existing contact.`
                    });
                }

                // 2. Get AI Response
                const aiResult = await lonySalesAI.generateResponse(messageText, context);
                console.log(`[Sales AI] Intent: ${aiResult.intent}, Priority: ${aiResult.priority}`);

                // 3. Save messages
                await supabase.from('sales_messages').insert([
                    {
                        conversation_id: conversation.id,
                        direction: 'incoming',
                        sender_phone: phone,
                        message_text: messageText
                    },
                    {
                        conversation_id: conversation.id,
                        direction: 'outgoing',
                        message_text: aiResult.response,
                        ai_response: aiResult.response,
                        ai_intent: aiResult.intent,
                        ai_priority: aiResult.priority
                    }
                ]);

                // 4. Update conversation
                await supabase.from('sales_conversations').update({
                    overall_intent: aiResult.intent,
                    priority: aiResult.priority,
                    ai_notes: aiResult.notes
                }).eq('id', conversation.id);

                // 5. Send AI Response
                await callEvolution(`/message/sendText/${accountId}`, 'POST', {
                    number: msg.key.remoteJid,
                    textMessage: { text: aiResult.response }
                });

                // 6. Handle Escalation
                if (aiResult.intent === 'escalation' || aiResult.priority === 'high') {
                    console.log(`[Webhook] 🚨 ESCALATION for ${phone}`);

                    await supabase.from('sales_conversations').update({
                        escalated: true,
                        escalated_at: new Date().toISOString(),
                        status: 'escalated'
                    }).eq('id', conversation.id);

                    const { data: messages } = await supabase
                        .from('sales_messages')
                        .select('*')
                        .eq('conversation_id', conversation.id)
                        .order('created_at', { ascending: true });

                    let summary = `🚨 *تصعيد من Sales AI*\n\n📱 ${phone} ${guest ? `(${guest.name})` : ''}\n🎯 ${aiResult.intent}\n⚠️ ${aiResult.priority}\n\n💬 المحادثة:\n`;
                    messages?.slice(-5).forEach(m => {
                        const p = m.direction === 'incoming' ? '👤' : '🤖';
                        const t = m.direction === 'incoming' ? m.message_text : m.ai_response;
                        summary += `${p}: ${t}\n`;
                    });

                    const ADMIN_PHONE = process.env.ADMIN_PHONE;
                    if (ADMIN_PHONE) {
                        const adminJid = ADMIN_PHONE.replace('+', '').replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                        await callEvolution(`/message/sendText/${accountId}`, 'POST', {
                            number: adminJid,
                            textMessage: { text: summary }
                        }).catch(e => console.error('[Admin notify error]', e));
                    }
                }
            }
        } catch (error) {
            console.error('[Webhook] Error processing message:', error);
        }
    }

    res.sendStatus(200);
});

// ===== SALES AI ROUTES =====

// Get all conversations
app.get('/api/sales/conversations', async (req, res) => {
    const { status, escalated } = req.query;

    let query = supabase.from('sales_dashboard').select('*');

    if (status) query = query.eq('status', status);
    if (escalated === 'true') query = query.eq('escalated', true);

    const { data, error } = await query.order('last_contact_at', { ascending: false });

    // Handle DB Error but always return success to keep frontend alive
    if (error) {
        console.error('DB Error:', error);
        return res.json({ conversations: [] });
    }
    res.json({ conversations: data || [] });
});

// Get single conversation with messages
app.get('/api/sales/conversations/:id', async (req, res) => {
    const { id } = req.params;

    const { data: conversation } = await supabase
        .from('sales_conversations')
        .select('*')
        .eq('id', id)
        .single();

    const { data: messages } = await supabase
        .from('sales_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

    res.json({ conversation, messages: messages || [] });
});

// Get escalated conversations summary for admin
app.get('/api/sales/escalated-summary', async (req, res) => {
    const { data } = await supabase
        .from('sales_dashboard')
        .select('*')
        .eq('escalated', true)
        .eq('status', 'escalated')
        .order('escalated_at', { ascending: false })
        .limit(10);

    res.json({ escalated: data || [] });
});

// Sending
app.post('/api/whatsapp/send', async (req, res) => {
    const { accountId, phone, message, imageUrl } = req.body;

    try {
        const number = phone.replace(/[^0-9]/g, '');
        const jid = `${number}@s.whatsapp.net`;

        let result;
        if (imageUrl) {
            result = await callEvolution(`/message/sendMedia/${accountId}`, 'POST', {
                number: jid, // Evolution v2 uses 'number' usually
                options: {
                    delay: 1200,
                    presence: "composing"
                },
                mediaMessage: {
                    mediatype: "image",
                    caption: message,
                    media: imageUrl // URL
                }
            });
        } else {
            result = await callEvolution(`/message/sendText/${accountId}`, 'POST', {
                number: jid,
                options: {
                    delay: 1200,
                    presence: "composing"
                },
                textMessage: {
                    text: message
                }
            });
        }

        if (result?.key?.id) {
            console.log(`[${accountId}] Sent to ${number}`);
            res.json({ success: true, message: 'Sent' });
        } else {
            throw new Error(JSON.stringify(result));
        }

    } catch (error) {
        console.error('Send Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bulk Sending Logic (Kept mostly same, using callEvolution)
app.post('/api/whatsapp/send-batch', async (req, res) => {
    const { eventId, mode = 'balanced' } = req.body;
    if (jobState.isRunning) return res.status(400).json({ error: 'Job already running' });

    // 1. Get connected account
    const { data: accounts } = await supabase.from('whatsapp_accounts').select('id, phone').eq('status', 'connected');

    // Fallback if no DB accounts
    let account = accounts?.[0];
    if (!account) {
        const adminPhone = process.env.ADMIN_PHONE || '+966503678789';
        const adminId = adminPhone.replace(/[^0-9]/g, '');
        account = { id: adminId, phone: adminId };
    }

    // 2. Get pending messages
    const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select(`
            id, guest_id, phone, message_text, image_url,
            guests (name)
        `)
        .eq('event_id', eventId)
        .eq('status', 'pending');

    if (!messages?.length) return res.status(400).json({ error: 'No pending messages for this event. Prepare them first.' });

    // 3. Start Job
    jobState = {
        isRunning: true,
        isPaused: false,
        eventId,
        total: messages.length,
        processed: 0,
        sent: 0,
        failed: 0,
        lastLog: 'Starting Evolution Batch...',
        shouldStop: false
    };

    // Async process
    (async () => {
        const waitTime = getSpeedDelay(mode);

        for (const msg of messages) {
            if (jobState.shouldStop) break;
            while (jobState.isPaused) await delay(1000);

            try {
                const number = msg.phone.replace(/[^0-9]/g, '');
                const jid = `${number}@s.whatsapp.net`;
                const guestName = msg.guests?.name || 'Guest';

                let res;
                if (msg.image_url) {
                    res = await callEvolution(`/message/sendMedia/${account.id}`, 'POST', {
                        number: jid,
                        options: { delay: 1000, presence: "composing" },
                        mediaMessage: {
                            mediatype: "image",
                            caption: msg.message_text,
                            media: msg.image_url
                        }
                    });
                } else {
                    res = await callEvolution(`/message/sendText/${account.id}`, 'POST', {
                        number: jid,
                        options: { delay: 1000, presence: "composing" },
                        textMessage: { text: msg.message_text }
                    });
                }

                if (res?.key?.id) {
                    jobState.sent++;
                    jobState.lastLog = `Sent: ${guestName}`;
                    // Update DB
                    await supabase.from('whatsapp_messages').update({
                        status: 'sent',
                        sent_at: new Date().toISOString(),
                        sender_account: account.phone
                    }).eq('id', msg.id);
                } else {
                    throw new Error(JSON.stringify(res));
                }

            } catch (e) {
                console.error(`Failed:`, e.message);
                jobState.failed++;
                jobState.lastLog = `Error: ${e.message}`;
                await supabase.from('whatsapp_messages').update({
                    status: 'failed',
                    error_message: e.message
                }).eq('id', msg.id);
            }

            jobState.processed++;
            await delay(waitTime);
        }
        jobState.isRunning = false;
        jobState.lastLog = jobState.shouldStop ? 'Stopped.' : 'Done.';
    })();

    res.json({ success: true, message: 'Batch started' });
});

// Control routes
app.post('/api/whatsapp/stop', (req, res) => { jobState.shouldStop = true; res.json({ success: true }); });
app.post('/api/whatsapp/pause', (req, res) => { jobState.isPaused = true; res.json({ success: true }); });
app.post('/api/whatsapp/resume', (req, res) => { jobState.isPaused = false; res.json({ success: true }); });

app.get(['/api/whatsapp/status', '/api/whatsapp/status/:eventId'], (req, res) => {
    const { eventId } = req.params;
    res.json({
        success: true,
        status: {
            isRunning: jobState.isRunning,
            isPaused: jobState.isPaused,
            lastLog: jobState.lastLog,
            stats: {
                sent: jobState.sent,
                failed: jobState.failed,
                pending: jobState.total - jobState.processed,
                queued: 0
            }
        }
    });
});
// Prepare messages stub
app.post('/api/whatsapp/prepare-messages', async (req, res) => {
    try {
        const { eventId, template, customMessage, messagePhase = 'initial', targetAudience = 'all' } = req.body;

        // 1. Get event details
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (eventError) throw eventError;

        // 2. Build guest query
        let query = supabase
            .from('guests')
            .select('id, name, phone, card_image_url, custom_data, rsvp_status')
            .eq('event_id', eventId);

        // Filters
        if (targetAudience === 'confirmed') {
            query = query.or('rsvp_status.eq.attending,rsvp_status.eq.confirmed');
        } else if (targetAudience === 'pending') {
            query = query.is('rsvp_status', null);
        } else if (targetAudience === 'declined') {
            query = query.eq('rsvp_status', 'declined');
        }

        const { data: guests, error: guestsError } = await query;
        if (guestsError) throw guestsError;

        // 3. Cleanup previous pending for this phase
        await supabase
            .from('whatsapp_messages')
            .delete()
            .eq('event_id', eventId)
            .eq('message_phase', messagePhase)
            .in('status', ['pending', 'queued']);

        // 4. Transform to messages
        const messages = guests
            .filter(g => g.phone)
            .map(guest => {
                const variables = getTemplateVariables(guest, event);
                const messageText = customMessage
                    ? fillTemplate(customMessage, variables)
                    : fillTemplate(template, variables);

                return {
                    event_id: eventId,
                    guest_id: guest.id,
                    phone: guest.phone,
                    message_text: messageText,
                    image_url: messagePhase === 'qr_code' ? (guest.card_image_url || null) : null,
                    message_phase: messagePhase,
                    status: 'pending'
                };
            });

        if (messages.length > 0) {
            const { data, error } = await supabase.from('whatsapp_messages').insert(messages).select();
            if (error) throw error;
            res.json({ success: true, count: messages.length, messages: data });
        } else {
            res.json({ success: true, count: 0, messages: [], message: 'No eligible guests found' });
        }

    } catch (error) {
        console.error('Prepare Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🚀 Adapter Server running on port ${PORT}`);
    console.log(`🔗 Connected to Evolution API at ${EVOLUTION_URL}`);
    console.log(`🛡️  Evolution API Key: ...${EVOLUTION_API_KEY.slice(-4)}`);

    // Auto-register webhook if possible
    // await autoRegisterWebhook(); // Disabled: We set it manually via script to avoid crashes
});
