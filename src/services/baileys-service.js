

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import geminiService from './gemini-service.js';
import rsvpAI from './rsvp-ai-service.js';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

class BaileysService {
    constructor() {
        this.clients = new Map(); // accountId -> socket
        this.qrCallbacks = new Map(); // accountId -> callback provided by server
        this.authFolders = './auth_sessions'; // Folder to store session data
        this.reconnectAttempts = new Map(); // Track reconnection attempts
        this.maxReconnectAttempts = 3;

        if (!fs.existsSync(this.authFolders)) {
            fs.mkdirSync(this.authFolders, { recursive: true });
        }
    }

    async initializeClient(accountId) {
        console.log(`[Baileys] Initializing client for ${accountId}`);

        // Check if already connected
        const existingClient = this.clients.get(accountId);
        if (existingClient && existingClient.user) {
            console.log(`[Baileys] Client ${accountId} already connected`);
            return existingClient;
        }

        const authPath = `${this.authFolders}/${accountId}`;
        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }), // Hide verbose logs
            printQRInTerminal: false,
            auth: state,
            browser: ["Lony Invitations", "Chrome", "1.0.0"], // Simulates a desktop connection
            connectTimeoutMs: 60000,
        });

        this.clients.set(accountId, sock);

        // Connection Update Handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle QR Code
            if (qr) {
                console.log(`[Baileys] QR Generated for ${accountId}`);
                const callback = this.qrCallbacks.get(accountId);
                if (callback) callback(qr);
            }

            // Handle Connection Status
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`[Baileys] Connection closed for ${accountId}. Status: ${statusCode}, Reconnecting: ${shouldReconnect}`);

                this.clients.delete(accountId);

                if (!shouldReconnect) {
                    // Logged out - update DB and stop
                    await supabase
                        .from('whatsapp_accounts')
                        .update({ status: 'disconnected' })
                        .eq('id', accountId);
                    this.reconnectAttempts.delete(accountId);
                } else {
                    // Check reconnect attempts
                    const attempts = (this.reconnectAttempts.get(accountId) || 0) + 1;

                    if (attempts <= this.maxReconnectAttempts) {
                        this.reconnectAttempts.set(accountId, attempts);
                        console.log(`[Baileys] Reconnect attempt ${attempts}/${this.maxReconnectAttempts} for ${accountId}`);
                        setTimeout(() => this.initializeClient(accountId), 3000);
                    } else {
                        console.log(`[Baileys] Max reconnect attempts reached for ${accountId}`);
                        this.reconnectAttempts.delete(accountId);
                    }
                }
            } else if (connection === 'open') {
                console.log(`[Baileys] Connection opened for ${accountId}`);
                this.reconnectAttempts.delete(accountId); // Reset on successful connection

                // Wait a bit for user info to be available
                if (sock.user) {
                    const userJid = sock.user.id.split(':')[0]; // Extract phone number
                    const phone = '+' + userJid;

                    await supabase
                        .from('whatsapp_accounts')
                        .update({
                            status: 'connected',
                            phone: phone,
                            name: 'Lony Client (' + phone.slice(-4) + ')'
                        })
                        .eq('id', accountId);
                } else {
                    // Just mark as connected without phone info
                    await supabase
                        .from('whatsapp_accounts')
                        .update({ status: 'connected' })
                        .eq('id', accountId);
                }
            }
        });

        // Credential Update Handler
        sock.ev.on('creds.update', saveCreds);

        // Message Delivery Status Listener
        sock.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                const { key, update: msgUpdate } = update;

                if (msgUpdate.status) {
                    const phone = '+' + key.remoteJid.replace('@s.whatsapp.net', '');

                    if (msgUpdate.status === 2) { // Delivered
                        console.log(`[Baileys] Message delivered to ${phone}`);
                        await supabase
                            .from('whatsapp_messages')
                            .update({
                                delivery_status: 'delivered',
                                delivered_at: new Date().toISOString()
                            })
                            .eq('phone', phone)
                            .is('delivered_at', null);
                    }

                    if (msgUpdate.status === 3) { // Read
                        console.log(`[Baileys] Message read by ${phone}`);
                        await supabase
                            .from('whatsapp_messages')
                            .update({
                                delivery_status: 'read',
                                read_at: new Date().toISOString()
                            })
                            .eq('phone', phone)
                            .is('read_at', null);
                    }
                }
            }
        });

        // Incoming Messages Listener (Replies)
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            for (const msg of messages) {
                // Skip messages sent by us
                if (msg.key.fromMe) continue;

                if (msg.message) {
                    const from = msg.key.remoteJid.replace('@s.whatsapp.net', '');
                    const phone = '+' + from;
                    const messageText = msg.message.conversation ||
                        msg.message.extendedTextMessage?.text || '';

                    console.log(`[Baileys] Received reply from ${phone}: ${messageText}`);

                    // Find the guest
                    const { data: guest } = await supabase
                        .from('guests')
                        .select('id, event_id, name')
                        .eq('phone', phone)
                        .single();

                    if (guest) {
                        // Find last message sent to this guest
                        const { data: lastMessage } = await supabase
                            .from('whatsapp_messages')
                            .select('id')
                            .eq('guest_id', guest.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();

                        // Detect RSVP using AI
                        console.log(`[Baileys] 🤖 Analyzing reply with AI...`);
                        const analysis = await rsvpAI.analyzeReply(messageText, guest.name);

                        console.log(`[Baileys] AI Analysis:`, {
                            is_rsvp: analysis.is_rsvp,
                            status: analysis.status,
                            confidence: analysis.confidence,
                            companion_count: analysis.companion_count
                        });

                        // Save reply with AI analysis
                        await supabase.from('whatsapp_replies').insert({
                            message_id: lastMessage?.id,
                            guest_id: guest.id,
                            event_id: guest.event_id,
                            phone: phone,
                            reply_text: messageText,
                            reply_type: 'text',
                            is_rsvp: analysis.is_rsvp,
                            rsvp_response: analysis.status,
                            ai_confidence: analysis.confidence,
                            companion_count: analysis.companion_count,
                            extracted_notes: analysis.notes,
                            received_at: new Date(msg.messageTimestamp * 1000).toISOString()
                        });

                        // Update guest RSVP status if detected with good confidence
                        if (analysis.is_rsvp && analysis.confidence >= 0.7) {
                            await supabase.from('guests').update({
                                rsvp_status: analysis.status,
                                companion_count: analysis.companion_count,
                                rsvp_notes: analysis.notes,
                                rsvp_at: new Date().toISOString()
                            }).eq('id', guest.id);

                            console.log(`[Baileys] ✅ RSVP Updated: ${guest.name} - ${analysis.status} (confidence: ${analysis.confidence})`);

                            // Auto-send personalized card on confirmation
                            if (analysis.status === 'confirmed') {
                                // Check if card already sent
                                const { data: existingCard } = await supabase
                                    .from('whatsapp_messages')
                                    .select('id')
                                    .eq('guest_id', guest.id)
                                    .eq('message_phase', 'personalized')
                                    .in('status', ['sent', 'delivered', 'read'])
                                    .maybeSingle();

                                if (!existingCard) {
                                    // Get card image URL
                                    const { data: guestData } = await supabase
                                        .from('guests')
                                        .select('card_image_url')
                                        .eq('id', guest.id)
                                        .single();

                                    if (guestData?.card_image_url) {
                                        console.log(`[Baileys] 🎯 Sending personalized card to ${guest.name}...`);

                                        // Send confirmation first
                                        const confirmMsg = `شكراً لتأكيد حضورك يا ${guest.name}! 🎉\n\nسنرسل لك كرت الدعوة خلال لحظات...`;
                                        await this.sendMessage(accountId, phone, confirmMsg);

                                        // Wait then send card
                                        setTimeout(async () => {
                                            try {
                                                const cardMsg = `هذا كرت دعوتك الخاص 💐\nاحتفظ به وأحضره معك يوم المناسبة.`;
                                                await this.sendMessage(accountId, phone, cardMsg, guestData.card_image_url);

                                                // Record in DB
                                                await supabase.from('whatsapp_messages').insert({
                                                    event_id: guest.event_id,
                                                    guest_id: guest.id,
                                                    phone: phone,
                                                    message_text: cardMsg,
                                                    image_url: guestData.card_image_url,
                                                    message_phase: 'personalized',
                                                    status: 'sent',
                                                    sent_at: new Date().toISOString()
                                                });

                                                console.log(`[Baileys] ✅ Card sent to ${guest.name}`);
                                            } catch (error) {
                                                console.error(`[Baileys] ❌ Failed to send card:`, error);
                                            }
                                        }, 2000);
                                    }
                                } else {
                                    console.log(`[Baileys] ℹ️ Card already sent to ${guest.name}`);
                                }
                            }
                        }
                    }
                }
            }
        });

        return sock;
    }

    detectRSVPResponse(text) {
        const lowerText = text.toLowerCase().trim();

        // Confirmation keywords
        const confirmed = ['نعم', 'أكيد', 'موافق', 'حاضر', 'yes', 'ok', 'تمام',
            'ان شاء الله', 'إن شاء الله', 'confirm', 'sure', 'اوكي', 'أوكي'];

        // Decline keywords
        const declined = ['لا', 'اعتذر', 'ما أقدر', 'no', 'sorry', 'مشغول',
            'ما اقدر', 'معذرة', 'decline', 'cant', "can't", 'ماقدر'];

        // Maybe keywords
        const maybe = ['ممكن', 'غير متأكد', 'maybe', 'not sure', 'مو متأكد',
            'ما ادري', 'شوف', 'نشوف', 'ماادري'];

        if (confirmed.some(k => lowerText.includes(k))) return 'confirmed';
        if (declined.some(k => lowerText.includes(k))) return 'declined';
        if (maybe.some(k => lowerText.includes(k))) return 'maybe';

        return null;
    }

    onQRCode(accountId, callback) {
        this.qrCallbacks.set(accountId, callback);
    }

    async sendMessage(accountId, phoneNumber, message, mediaUrl = null) {
        const sock = this.clients.get(accountId);
        if (!sock) throw new Error(`Client ${accountId} not connected`);

        // Format number: remove + and spaces, append @s.whatsapp.net for JID
        const jid = phoneNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

        try {
            if (mediaUrl) {
                // Send Image
                await sock.sendMessage(jid, {
                    image: { url: mediaUrl },
                    caption: message
                });
            } else {
                // Send Text
                await sock.sendMessage(jid, { text: message });
            }
            return { success: true };
        } catch (error) {
            console.error(`[Baileys] Failed to send to ${phoneNumber}:`, error);
            throw error;
        }
    }

    async disconnect(accountId) {
        const sock = this.clients.get(accountId);
        if (sock) {
            sock.end(undefined); // Close connection
            this.clients.delete(accountId);
        }

        // Remove auth folder to fully logout
        const authPath = `${this.authFolders}/${accountId}`;
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }

        await supabase
            .from('whatsapp_accounts')
            .update({ status: 'disconnected' })
            .eq('id', accountId);
    }

    async disconnectAll() {
        for (const accountId of this.clients.keys()) {
            await this.disconnect(accountId);
        }
    }
}

const baileysService = new BaileysService();
export default baileysService;
