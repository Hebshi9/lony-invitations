
import pkg from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = pkg;
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
        this.currentQR = new Map(); // accountId -> current QR code string
        this.authFolders = './auth_sessions'; // Folder to store session data
        this.reconnectAttempts = new Map(); // Track reconnection attempts
        this.maxReconnectAttempts = 3;

        if (!fs.existsSync(this.authFolders)) {
            fs.mkdirSync(this.authFolders, { recursive: true });
        }
    }

    async initializeClient(accountId) {
        console.log(`[Baileys] 🔄 Initializing client for ${accountId}`);

        // Check if already connected
        const existingClient = this.clients.get(accountId);
        if (existingClient && existingClient.user) {
            console.log(`[Baileys] ✓ Client ${accountId} already connected as ${existingClient.user.id}`);
            return existingClient;
        }

        const authPath = `${this.authFolders}/${accountId}`;
        console.log(`[Baileys] Auth path: ${authPath}`);

        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const { version } = await fetchLatestBaileysVersion();
        console.log(`[Baileys] Using Baileys version: ${version}`);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }), // Hide verbose logs
            printQRInTerminal: false,
            auth: state,
            browser: ["Lony Invitations", "Chrome", "1.0.0"], // Simulates a desktop connection
            connectTimeoutMs: 60000,
        });

        this.clients.set(accountId, sock);
        console.log(`[Baileys] Socket created and registered for ${accountId}`);

        // Connection Update Handler
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle QR Code
            if (qr) {
                console.log(`[Baileys] QR Generated for ${accountId}`);
                // Store QR code for polling
                this.currentQR.set(accountId, qr);
                // Call registered callbacks
                const callback = this.qrCallbacks.get(accountId);
                if (callback) callback(qr);
            }

            // Handle Connection Status
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`[Baileys] Connection closed for ${accountId}. Status: ${statusCode}, Reconnecting: ${shouldReconnect}`);

                this.clients.delete(accountId);
                this.currentQR.delete(accountId); // Clear QR code

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
                this.currentQR.delete(accountId); // Clear QR code on successful connection

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
                    // Debug PING
                    const rawText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                    if (rawText.toUpperCase().trim() === 'PING') {
                        console.log('🏓 PING RECEIVED! Connection is alive.');
                        await sock.sendMessage(msg.key.remoteJid, { text: 'PONG 🏓' });
                        continue;
                    }

                    // Extract phone number reliably (handle @s.whatsapp.net, @g.us, etc)
                    const jid = msg.key.remoteJid;
                    const userPart = jid.split('@')[0];
                    const phone = '+' + userPart;

                    const messageText = msg.message.conversation ||
                        msg.message.extendedTextMessage?.text || '';

                    console.log(`[Baileys] 📨 Received message from JID: ${jid}`);
                    console.log(`[Baileys] 📞 Extracted Phone: ${phone}`);
                    console.log(`[Baileys] 💬 Text: ${messageText}`);

                    // Skip if it's a status update (broadcast)
                    if (jid === 'status@broadcast') return;

                    // 1. Find correct context by looking at the last message sent to this phone
                    // This solves the identity problem (e.g. "Hozam" appearing in wrong event)
                    const { data: lastMsg } = await supabase
                        .from('whatsapp_messages')
                        .select('id, guest_id, event_id, guests(name, id, event_id, rsvp_status, card_image_url)')
                        .eq('phone', phone)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    let guest = null;
                    if (lastMsg && lastMsg.guests) {
                        guest = lastMsg.guests;
                        console.log(`[Baileys] ✅ Identified guest ${guest.name} from message history (Event: ${guest.event_id})`);
                    } else {
                        // Fallback: Global search by phone (less accurate across multiple events)
                        console.log(`[Baileys] ⚠️ No message history found for ${phone}. Performing global lookup...`);
                        const { data: globalGuest } = await supabase
                            .from('guests')
                            .select('id, event_id, name, rsvp_status, card_image_url')
                            .eq('phone', phone)
                            .maybeSingle();
                        guest = globalGuest;
                    }

                    if (guest) {
                        await this.processReply(msg, guest, phone, messageText, accountId);
                    } else {
                        console.log(`[Baileys] ❌ No guest found for phone ${phone}. Ignoring message.`);
                    }
                }
            }
        });

        return sock;
    }

    async processReply(msg, guest, phone, messageText, accountId) {
        if (!messageText) return;

        // 1. Find last message sent to this guest to link context
        const { data: lastMessage } = await supabase
            .from('whatsapp_messages')
            .select('id, message_phase')
            .eq('guest_id', guest.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // 2. AI Analysis
        console.log(`[Baileys] 🤖 Analyzing reply from ${guest.name}: "${messageText}"`);
        const analysis = await rsvpAI.analyzeReply(messageText, guest.name);

        console.log(`[Baileys] 🧠 AI Result:`, JSON.stringify(analysis, null, 2));

        // 3. Save Reply Log
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

        // 4. Handle Smart Automation
        if (analysis.is_rsvp && analysis.status) {
            // Update Guest Status
            await supabase.from('guests').update({
                rsvp_status: analysis.status,
                companion_count: analysis.companion_count,
                rsvp_notes: analysis.notes,
                rsvp_at: new Date().toISOString()
            }).eq('id', guest.id);

            console.log(`[Baileys] ✅ Guest ${guest.name} status updated to: ${analysis.status}`);

            // === AUTOMATION LOGIC ===

            // Case A: CONFIRMED -> Send Private Card
            // STRICT CHECK: Only confirmed and High Confidence
            if (analysis.status === 'confirmed' && analysis.confidence >= 0.8) {
                // Verify if we should send card (only if not sent before)
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
                        console.log(`[Baileys] 🚀 Auto-Sending Private Card to ${guest.name}...`);
                        const cardMsg = `شكراً لتأكيدك 💐\nهذا كرت الدخول الخاص بك، نتشرف بحضورك.`;

                        try {
                            await this.sendMessage(accountId, phone, cardMsg, guestData.card_image_url);

                            // Log value
                            await supabase.from('whatsapp_messages').insert({
                                event_id: guest.event_id,
                                guest_id: guest.id,
                                phone: phone,
                                message_text: cardMsg,
                                image_url: guestData.card_image_url,
                                message_phase: 'personalized', // Mark as the card phase
                                status: 'sent',
                                sent_at: new Date().toISOString(),
                                sender_account: (await this.getAccountPhone(accountId))
                            });
                            console.log(`[Baileys] ✅ Private Card Sent Successfully!`);
                        } catch (err) {
                            console.error(`[Baileys] ❌ Failed to auto-send card:`, err);
                        }
                    } else {
                        console.log(`[Baileys] ⚠️ No card image found for ${guest.name}, skipping auto-send.`);
                    }
                } else {
                    console.log(`[Baileys] ℹ️ Private card was already sent previously.`);
                }
            }

            // Case B: DECLINED -> Just Logged (Already done by DB update above)
            else if (analysis.status === 'declined') {
                console.log(`[Baileys] 📉 Guest declined. Status updated. No further action.`);
            }
        }
    }

    async getAccountPhone(accountId) {
        const sock = this.clients.get(accountId);
        if (sock?.user?.id) {
            return '+' + sock.user.id.split(':')[0];
        }
        return 'unknown';
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
        console.log(`[Baileys] 📤 sendMessage called - Account: ${accountId}, Phone: ${phoneNumber}, HasMedia: ${!!mediaUrl}`);

        const sock = this.clients.get(accountId);
        if (!sock) {
            const error = `Client ${accountId} not connected. Available clients: ${Array.from(this.clients.keys()).join(', ')}`;
            console.error(`[Baileys] ❌ ${error}`);
            throw new Error(error);
        }

        // Verify socket is actually connected
        if (!sock.user) {
            const error = `Client ${accountId} exists but not authenticated (no user data)`;
            console.error(`[Baileys] ❌ ${error}`);
            throw new Error(error);
        }

        console.log(`[Baileys] ✓ Socket found and authenticated as: ${sock.user.id}`);

        // Enhanced phone number validation and formatting
        if (!phoneNumber || phoneNumber.trim() === '') {
            throw new Error('Phone number is empty or invalid');
        }

        // Format number: remove all non-digits, append @s.whatsapp.net for JID
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (cleanNumber.length < 10) {
            throw new Error(`Phone number too short after cleaning: ${cleanNumber} (original: ${phoneNumber})`);
        }

        const jid = cleanNumber + '@s.whatsapp.net';
        console.log(`[Baileys] 📞 Formatted JID: ${jid}`);

        try {
            if (mediaUrl) {
                console.log(`[Baileys] 🖼️ Sending image message to ${jid}`);
                console.log(`[Baileys] Image URL: ${mediaUrl}`);
                console.log(`[Baileys] Caption: ${message.substring(0, 50)}...`);

                await sock.sendMessage(jid, {
                    image: { url: mediaUrl },
                    caption: message
                });
                console.log(`[Baileys] ✅ Image message sent successfully to ${phoneNumber}`);
            } else {
                console.log(`[Baileys] 💬 Sending text message to ${jid}`);
                console.log(`[Baileys] Message: ${message.substring(0, 50)}...`);

                await sock.sendMessage(jid, { text: message });
                console.log(`[Baileys] ✅ Text message sent successfully to ${phoneNumber}`);
            }

            return { success: true, jid, phoneNumber };
        } catch (error) {
            console.error(`[Baileys] ❌ SEND FAILED to ${phoneNumber} (${jid}):`);
            console.error(`[Baileys] Error name: ${error.name}`);
            console.error(`[Baileys] Error message: ${error.message}`);
            console.error(`[Baileys] Full error:`, error);

            // Re-throw with enhanced error information
            throw new Error(`Failed to send to ${phoneNumber}: ${error.message}`);
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
