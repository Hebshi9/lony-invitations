import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import pkg from '@whiskeysockets/baileys';
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = pkg;
import { Boom } from '@hapi/boom';
import pino from 'pino';
import lonySalesAI from '../src/services/lony-sales-ai.js';
import rsvpAI from '../src/services/rsvp-ai-service.js';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// Store active sockets
const activeSockets = new Map();
let currentQR = null;

// Initialize Baileys connection
async function initializeWhatsApp(accountId) {
    const authDir = path.join(process.cwd(), 'auth_sessions', accountId);

    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 QR Code generated');
            currentQR = qr;
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log('Connection closed. Reconnect:', shouldReconnect);

            if (shouldReconnect) {
                setTimeout(() => initializeWhatsApp(accountId), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connected!');
            currentQR = null;

            await supabase.from('whatsapp_accounts').update({
                status: 'connected'
            }).eq('id', accountId);
        }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (msg.key.fromMe) continue;

            const phone = '+' + (msg.key.remoteJid?.split('@')[0] || '');
            const messageText = msg.message?.conversation ||
                msg.message?.extendedTextMessage?.text || '';

            if (!messageText) continue;

            console.log(`📨 From ${phone}: "${messageText}"`);

            try {
                // Check if guest
                const { data: potentialGuests } = await supabase
                    .from('guests')
                    .select('id, name, event_id, rsvp_status, card_image_url')
                    .eq('phone', phone);

                let guest = null;
                if (potentialGuests && potentialGuests.length > 0) {
                    if (potentialGuests.length === 1) {
                        guest = potentialGuests[0];
                    } else {
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
                    // RSVP Flow
                    console.log(`👤 Guest: ${guest.name}`);
                    const analysis = await rsvpAI.analyzeReply(messageText, guest.name);

                    await supabase.from('whatsapp_replies').insert({
                        guest_id: guest.id,
                        event_id: guest.event_id,
                        phone: phone,
                        reply_text: messageText,
                        is_rsvp: analysis.is_rsvp,
                        rsvp_response: analysis.status,
                        ai_confidence: analysis.confidence
                    });

                    if (analysis.is_rsvp && analysis.status) {
                        await supabase.from('guests').update({
                            rsvp_status: analysis.status,
                            rsvp_at: new Date().toISOString()
                        }).eq('id', guest.id);

                        if (analysis.status === 'confirmed' && guest.card_image_url) {
                            const reply = `شكراً لتأكيد حضورك يا ${guest.name} 🌹\nهذا كرت الدخول الخاص بك.`;
                            await sock.sendMessage(msg.key.remoteJid, {
                                image: { url: guest.card_image_url },
                                caption: reply
                            });
                        }
                    }
                } else {
                    // Sales AI Flow
                    console.log(`🤖 Sales inquiry from ${phone}`);

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
                            .select()
                            .single();
                        conversation = newConv;
                    }

                    const aiResult = await lonySalesAI.generateResponse(messageText);

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

                    await supabase.from('sales_conversations').update({
                        overall_intent: aiResult.intent,
                        priority: aiResult.priority,
                        ai_notes: aiResult.notes
                    }).eq('id', conversation.id);

                    await sock.sendMessage(msg.key.remoteJid, {
                        text: aiResult.response
                    });

                    // Escalation
                    if (aiResult.intent === 'escalation' || aiResult.priority === 'high') {
                        console.log(`🚨 ESCALATION for ${phone}`);

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

                        let summary = `🚨 *تصعيد من Sales AI*\n\n📱 ${phone}\n🎯 ${aiResult.intent}\n⚠️ ${aiResult.priority}\n\n💬 المحادثة:\n`;
                        messages?.slice(-5).forEach(m => {
                            const p = m.direction === 'incoming' ? '👤' : '🤖';
                            const t = m.direction === 'incoming' ? m.message_text : m.ai_response;
                            summary += `${p}: ${t}\n`;
                        });

                        const ADMIN_PHONE = process.env.ADMIN_PHONE;
                        if (ADMIN_PHONE) {
                            const adminJid = ADMIN_PHONE.replace('+', '') + '@s.whatsapp.net';
                            await sock.sendMessage(adminJid, { text: summary });
                            console.log(`✅ Escalation sent to ${ADMIN_PHONE}`);
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        }
    });

    activeSockets.set(accountId, sock);
    return sock;
}

// === API Routes ===

app.get('/api/whatsapp/qr-status/:accountId', (req, res) => {
    const { accountId } = req.params;
    const sock = activeSockets.get(accountId);

    res.json({
        connected: sock ? true : false,
        qr: currentQR
    });
});

app.post('/api/whatsapp/connect/:accountId', async (req, res) => {
    const { accountId } = req.params;

    try {
        if (!activeSockets.has(accountId)) {
            await initializeWhatsApp(accountId);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/whatsapp/disconnect/:accountId', async (req, res) => {
    const { accountId } = req.params;
    const sock = activeSockets.get(accountId);

    if (sock) {
        await sock.logout();
        activeSockets.delete(accountId);
    }

    res.json({ success: true });
});

app.get('/api/whatsapp/accounts', async (req, res) => {
    const { data } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .order('created_at', { ascending: false });

    res.json({ accounts: data || [] });
});

app.post('/api/whatsapp/accounts', async (req, res) => {
    const { phone, name } = req.body;

    const { data, error } = await supabase
        .from('whatsapp_accounts')
        .insert({ phone, name, status: 'disconnected' })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ account: data });
});

app.delete('/api/whatsapp/accounts/:id', async (req, res) => {
    const { id } = req.params;

    const sock = activeSockets.get(id);
    if (sock) {
        await sock.logout();
        activeSockets.delete(id);
    }

    const authDir = path.join(process.cwd(), 'auth_sessions', id);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true });
    }

    await supabase.from('whatsapp_accounts').delete().eq('id', id);

    res.json({ success: true });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Server (Baileys) running on port ${PORT}`);
    console.log(`📱 Open: http://localhost:5173/whatsapp-sender`);
    console.log(`🔗 Admin phone: ${process.env.ADMIN_PHONE || 'Not set'}\n`);
});
