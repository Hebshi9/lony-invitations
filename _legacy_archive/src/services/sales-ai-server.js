// Simple Sales AI WhatsApp Server - Standalone
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import pkg from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkg;
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import AI services
import lonySalesAI from '../src/services/lony-sales-ai.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

// Store active sockets and QR codes
const activeSockets = new Map();
const currentQRCodes = new Map();

// Initialize WhatsApp connection
async function initWhatsApp(accountId) {
    console.log(`\n🔄 Initializing WhatsApp for account: ${accountId}`);

    const authDir = path.join(__dirname, '..', 'auth_sessions', accountId);

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
            console.log('\n📱 QR Code generated!');
            console.log('====================');
            qrcodeTerminal.generate(qr, { small: true });
            console.log('====================\n');
            currentQRCodes.set(accountId, qr);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)
                ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
                : true;

            console.log(`❌ Connection closed. Reconnect: ${shouldReconnect}`);

            if (shouldReconnect) {
                setTimeout(() => initWhatsApp(accountId), 5000);
            } else {
                activeSockets.delete(accountId);
                currentQRCodes.delete(accountId);

                await supabase.from('whatsapp_accounts').update({
                    status: 'disconnected'
                }).eq('id', accountId);
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp connected successfully!');
            console.log(`📱 Admin Phone: ${process.env.ADMIN_PHONE || 'Not set'}\n`);

            currentQRCodes.delete(accountId);

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
                msg.message?.extendedTextMessage?.text ||
                msg.message?.imageMessage?.caption || '';

            if (!messageText) continue;

            console.log(`\n📨 Message from ${phone}: "${messageText}"`);

            try {
                // Find or create conversation
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
                    console.log(`🆕 New conversation created for ${phone}`);
                }

                // Get AI response
                const aiResult = await lonySalesAI.generateResponse(messageText);
                console.log(`🤖 AI Response: ${aiResult.response.substring(0, 50)}...`);
                console.log(`📊 Intent: ${aiResult.intent}, Priority: ${aiResult.priority}`);

                // Save messages
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

                // Update conversation
                await supabase.from('sales_conversations').update({
                    overall_intent: aiResult.intent,
                    priority: aiResult.priority,
                    ai_notes: aiResult.notes
                }).eq('id', conversation.id);

                // Send AI response
                await sock.sendMessage(msg.key.remoteJid, {
                    text: aiResult.response
                });
                console.log(`✅ Response sent to ${phone}\n`);

                // Handle escalation
                if (aiResult.intent === 'escalation' || aiResult.priority === 'high') {
                    console.log(`🚨 ESCALATION DETECTED for ${phone}`);

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

                    let summary = `🚨 *تصعيد من Sales AI*\n\n`;
                    summary += `📱 ${phone}\n`;
                    summary += `🎯 ${aiResult.intent}\n`;
                    summary += `⚠️ ${aiResult.priority}\n\n`;
                    summary += `💬 المحادثة:\n`;
                    summary += `━━━━━━━━━━\n`;

                    messages?.slice(-5).forEach(m => {
                        const prefix = m.direction === 'incoming' ? '👤 العميل' : '🤖 لوني';
                        const text = m.direction === 'incoming' ? m.message_text : m.ai_response;
                        summary += `${prefix}: ${text}\n`;
                    });

                    const ADMIN_PHONE = process.env.ADMIN_PHONE;
                    if (ADMIN_PHONE) {
                        try {
                            const adminJid = ADMIN_PHONE.replace('+', '') + '@s.whatsapp.net';
                            await sock.sendMessage(adminJid, { text: summary });
                            console.log(`✅ Escalation sent to ${ADMIN_PHONE}\n`);
                        } catch (err) {
                            console.error(`❌ Failed to send escalation:`, err.message);
                        }
                    } else {
                        console.warn(`⚠️ ADMIN_PHONE not set in .env!`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error processing message:`, error.message);
            }
        }
    });

    activeSockets.set(accountId, sock);
    return sock;
}

// === API Routes ===

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        service: 'Sales AI WhatsApp Server',
        admin_phone: process.env.ADMIN_PHONE || 'Not set'
    });
});

// Get QR code
app.get('/api/whatsapp/qr/:accountId', (req, res) => {
    const { accountId } = req.params;
    const qr = currentQRCodes.get(accountId);

    res.json({
        connected: activeSockets.has(accountId),
        qr: qr || null
    });
});

// Connect account
app.post('/api/whatsapp/connect/:accountId', async (req, res) => {
    const { accountId } = req.params;

    try {
        if (!activeSockets.has(accountId)) {
            await initWhatsApp(accountId);
        }
        res.json({ success: true, message: 'Connection initiated. Check terminal for QR code.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Disconnect account
app.post('/api/whatsapp/disconnect/:accountId', async (req, res) => {
    const { accountId } = req.params;
    const sock = activeSockets.get(accountId);

    if (sock) {
        await sock.logout();
        activeSockets.delete(accountId);
        currentQRCodes.delete(accountId);
    }

    await supabase.from('whatsapp_accounts').update({
        status: 'disconnected'
    }).eq('id', accountId);

    res.json({ success: true });
});

// Get accounts
app.get('/api/whatsapp/accounts', async (req, res) => {
    const { data } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .order('created_at', { ascending: false });

    const accounts = (data || []).map(acc => ({
        ...acc,
        connected: activeSockets.has(acc.id)
    }));

    res.json({ accounts });
});

// Create account
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

// Delete account
app.delete('/api/whatsapp/accounts/:id', async (req, res) => {
    const { id } = req.params;

    const sock = activeSockets.get(id);
    if (sock) {
        try {
            await sock.logout();
        } catch (e) { }
        activeSockets.delete(id);
        currentQRCodes.delete(id);
    }

    const authDir = path.join(__dirname, '..', 'auth_sessions', id);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true });
    }

    await supabase.from('whatsapp_accounts').delete().eq('id', id);

    res.json({ success: true });
});

// Sales conversations API
app.get('/api/sales/conversations', async (req, res) => {
    const { status } = req.query;

    let query = supabase.from('sales_conversations').select('*');
    if (status) query = query.eq('status', status);

    const { data } = await query.order('last_contact_at', { ascending: false });
    res.json({ conversations: data || [] });
});

// Start server
app.listen(PORT, () => {
    console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log('🚀 Sales AI WhatsApp Server (Baileys)');
    console.log('═══════════════════════════════════════');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🌐 Frontend: http://localhost:5173/whatsapp-sender`);
    console.log(`📱 Admin: ${process.env.ADMIN_PHONE || '⚠️  NOT SET'}`);
    console.log(`🤖 AI: OpenAI GPT-4o-mini`);
    console.log('═══════════════════════════════════════\n');
});
