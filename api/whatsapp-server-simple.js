// Simplified WhatsApp Server (No TypeScript Dependencies)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

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

// WhatsApp connections storage
const connections = new Map();

// Root route
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: '🚀 Lony WhatsApp Server',
        endpoints: {
            accounts: '/api/whatsapp/accounts',
            connect: '/api/whatsapp/connect/:accountId',
            send: '/api/whatsapp/send',
            prepareMessages: '/api/whatsapp/prepare-messages',
            sendBatch: '/api/whatsapp/send-batch',
            status: '/api/whatsapp/status'
        }
    });
});

// ============= Account Management =============

app.get('/api/whatsapp/accounts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('whatsapp_accounts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const accountsWithStatus = data.map(acc => ({
            ...acc,
            connected: connections.has(acc.id),
            status: connections.has(acc.id) ? 'connected' : 'disconnected'
        }));

        res.json({ success: true, accounts: accountsWithStatus });
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/whatsapp/accounts', async (req, res) => {
    try {
        const { phone, name, daily_limit } = req.body;

        const { data, error } = await supabase
            .from('whatsapp_accounts')
            .insert([{
                phone,
                name: name || phone,
                daily_limit: daily_limit || 170,
                is_active: true
            }])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, account: data });
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/whatsapp/connect/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;

        if (connections.has(accountId)) {
            return res.json({
                success: true,
                message: 'Already connected',
                connected: true
            });
        }

        const authDir = path.join(__dirname, '../.wwebjs_auth', accountId);
        const { state, saveCreds } = await useMultiFileAuthState(authDir);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true
        });

        let qrCode = null;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCode = qr;
                console.log(`[${accountId}] QR Code generated`);
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`[${accountId}] Connection closed. Reconnect:`, shouldReconnect);

                connections.delete(accountId);

                await supabase
                    .from('whatsapp_accounts')
                    .update({ is_connected: false })
                    .eq('id', accountId);
            } else if (connection === 'open') {
                console.log(`[${accountId}] Connected successfully!`);
                connections.set(accountId, sock);

                await supabase
                    .from('whatsapp_accounts')
                    .update({
                        is_connected: true,
                        last_connected_at: new Date().toISOString()
                    })
                    .eq('id', accountId);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        await new Promise(resolve => setTimeout(resolve, 2000));

        res.json({
            success: true,
            qr: qrCode,
            message: 'Scan QR code to connect'
        });

    } catch (error) {
        console.error('Error connecting account:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Message Sending =============

app.post('/api/whatsapp/prepare-messages', async (req, res) => {
    try {
        const { eventId, template, customMessage } = req.body;

        if (!eventId) {
            return res.status(400).json({
                success: false,
                error: 'Event ID is required'
            });
        }

        const { data: guests, error } = await supabase
            .from('guests')
            .select('id, name, phone, card_image_url, qr_token')
            .eq('event_id', eventId);

        if (error) {
            console.error('Supabase error:', error);
            return res.status(500).json({
                success: false,
                error: `Database error: ${error.message}`
            });
        }

        if (!guests || guests.length === 0) {
            return res.json({
                success: true,
                count: 0,
                guests: [],
                message: 'No guests found for this event'
            });
        }

        console.log(`✅ Prepared ${guests.length} messages for event ${eventId}`);
        res.json({ success: true, count: guests.length, guests });

    } catch (error) {
        console.error('Error preparing messages:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Unknown error occurred'
        });
    }
});

app.post('/api/whatsapp/send-batch', async (req, res) => {
    try {
        const { eventId } = req.body;

        const { data: guests, error: guestsError } = await supabase
            .from('guests')
            .select('id, name, phone, card_image_url, qr_token')
            .eq('event_id', eventId);

        if (guestsError) throw guestsError;

        const connectedAccounts = Array.from(connections.keys());
        if (connectedAccounts.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No connected accounts'
            });
        }

        const accountId = connectedAccounts[0];
        const sock = connections.get(accountId);

        let sent = 0;
        let failed = 0;

        for (const guest of guests) {
            if (!guest.phone) continue;

            try {
                const jid = guest.phone.includes('@') ? guest.phone : `${guest.phone}@s.whatsapp.net`;
                const message = `مرحباً ${guest.name}!\n\nيسعدنا دعوتك لحضور مناسبتنا السعيدة 🌹`;

                if (guest.card_image_url) {
                    // Download image from URL and convert to buffer
                    console.log(`📥 Downloading image for ${guest.name}...`);
                    const response = await fetch(guest.card_image_url);

                    if (!response.ok) {
                        throw new Error(`Failed to download image: ${response.statusText}`);
                    }

                    const arrayBuffer = await response.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // Send image with caption
                    await sock.sendMessage(jid, {
                        image: buffer,
                        caption: message
                    });
                    console.log(`📸 Sent image to ${guest.name}`);
                } else {
                    // Send text only
                    await sock.sendMessage(jid, { text: message });
                    console.log(`💬 Sent text to ${guest.name}`);
                }

                sent++;
                console.log(`✅ Sent to ${guest.name}`);

                await new Promise(resolve => setTimeout(resolve, 3000));

            } catch (error) {
                failed++;
                console.error(`❌ Failed to send to ${guest.name}:`, error.message);
            }
        }

        res.json({
            success: true,
            sent,
            failed,
            total: guests.length
        });

    } catch (error) {
        console.error('Error sending batch:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { accountId, phone, message, imageUrl } = req.body;

        const sock = connections.get(accountId);
        if (!sock) {
            return res.status(400).json({
                success: false,
                error: 'Account not connected'
            });
        }

        const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

        if (imageUrl) {
            await sock.sendMessage(jid, {
                image: { url: imageUrl },
                caption: message
            });
        } else {
            await sock.sendMessage(jid, { text: message });
        }

        console.log(`[${accountId}] Message sent to ${phone}`);
        res.json({ success: true, message: 'Message sent' });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/whatsapp/status', (req, res) => {
    const status = {
        totalAccounts: connections.size,
        connectedAccounts: Array.from(connections.keys())
    };
    res.json({ success: true, status });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 WhatsApp Server running on port ${PORT}`);
    console.log(`📱 Frontend URL: http://localhost:3000/whatsapp`);
    console.log(`🔗 API URL: http://localhost:${PORT}/api/whatsapp\n`);
});
