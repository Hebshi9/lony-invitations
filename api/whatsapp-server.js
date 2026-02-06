// WhatsApp API Routes
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import whatsappService from '../src/services/baileys-service.js';
import queueManager from '../src/services/queue-manager.js';
import { createClient } from '@supabase/supabase-js';
import { fillTemplate, getTemplateVariables } from '../src/services/message-templates.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Initialize Gemini
let genAIModel = null;
if (process.env.VITE_GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);
        genAIModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        console.log('✨ Gemini AI Initialized');
    } catch (e) {
        console.error('❌ Failed to initialize Gemini:', e);
    }
}

// Root route
app.get('/', (req, res) => {
    res.send('🚀 Lony WhatsApp Server is running! Please use the frontend at http://localhost:5173');
});

// ============= Account Management =============

/**
 * POST /api/whatsapp/accounts
 * Add a new WhatsApp account
 */
app.post('/api/whatsapp/accounts', async (req, res) => {
    try {
        const { phone, name, daily_limit } = req.body;

        const { data, error } = await supabase
            .from('whatsapp_accounts')
            .insert([{
                phone,
                name: name || phone,
                daily_limit: daily_limit || 170
            }])
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, account: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/whatsapp/accounts
 * Get all WhatsApp accounts
 */
app.get('/api/whatsapp/accounts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('whatsapp_accounts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, accounts: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/whatsapp/accounts/:accountId
 * Delete an account
 */
app.delete('/api/whatsapp/accounts/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;

        // Disconnect first
        await whatsappService.disconnect(accountId);

        // Delete from database
        const { error } = await supabase
            .from('whatsapp_accounts')
            .delete()
            .eq('id', accountId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Connection Management =============

/**
 * POST /api/whatsapp/connect/:accountId
 * Connect to WhatsApp for a specific account
 */
app.post('/api/whatsapp/connect/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;

        // Get account details
        const { data: account, error } = await supabase
            .from('whatsapp_accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (error) throw error;

        // Initialize client
        await whatsappService.initializeClient(accountId);

        res.json({
            success: true,
            message: 'Initializing WhatsApp client. Please scan QR code.'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/whatsapp/qr/:accountId
 * Get QR code for account (Server-Sent Events)
 */
app.get('/api/whatsapp/qr/:accountId', (req, res) => {
    const { accountId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Register callback for QR code
    whatsappService.onQRCode(accountId, (qr) => {
        res.write(`data: ${JSON.stringify({ qr })}\n\n`);
    });

    req.on('close', () => {
        res.end();
    });
});

/**
 * GET /api/whatsapp/qr-status/:accountId
 * Get QR code status and connection state
 */
app.get('/api/whatsapp/qr-status/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;

        // Check if client is connected
        const client = whatsappService.clients.get(accountId);

        if (client && client.user) {
            // Already connected
            return res.json({
                success: true,
                connected: true,
                qr: null
            });
        }

        // Get current QR code if available
        const qrCode = whatsappService.currentQR?.get(accountId);

        res.json({
            success: true,
            connected: false,
            qr: qrCode || null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});


/**
 * POST /api/whatsapp/disconnect/:accountId
 * Disconnect an account
 */
app.post('/api/whatsapp/disconnect/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        await whatsappService.disconnect(accountId);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= AI Generation =============

/**
 * POST /api/whatsapp/generate-message
 * Generate or polish a message using AI
 */
app.post('/api/whatsapp/generate-message', async (req, res) => {
    try {
        const { eventId, context, tone = 'formal' } = req.body;

        if (!genAIModel) {
            return res.status(503).json({
                success: false,
                error: 'AI service not configured on server.'
            });
        }

        // Fetch event details for context
        let eventContext = '';
        if (eventId) {
            const { data: event } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();
            if (event) {
                eventContext = `
                Event: ${event.name}
                Date: ${event.event_date || 'TBD'}
                Location: ${event.location || 'TBD'}
                type: ${event.type || 'Wedding'}
                `;
            }
        }

        const prompt = `
        You are an expert copywriter for Saudi events (Weddings, gatherings).
        Write a WhatsApp invitation message.
        
        Context:
        ${eventContext}
        
        Tone: ${tone} (Polite, warm, Saudi dialect).
        
        Requirements:
        - Use emojis.
        - Include placeholders like {{name}} for guest name.
        - If location is available, mention it.
        - Keep it concise (under 60 words).
        - Arabic language only.
        
        Current Draft (if any): "${context || ''}"
        
        Output only the message text.
        `;

        const result = await genAIModel.generateContent(prompt);
        const text = result.response.text().trim();

        res.json({ success: true, message: text });

    } catch (error) {
        console.error('AI Gen Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Message Sending =============

/**
 * POST /api/whatsapp/prepare-messages
 * Prepare messages for an event
 */
app.post('/api/whatsapp/prepare-messages', async (req, res) => {
    try {
        const { eventId, template, customMessage, messagePhase = 'initial', targetAudience = 'all' } = req.body;

        // Get event details
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (eventError) throw eventError;

        // Build query
        let query = supabase
            .from('guests')
            .select('id, name, phone, card_image_url, custom_data, rsvp_status')
            .eq('event_id', eventId);

        // Apply filters
        if (targetAudience === 'confirmed') {
            query = query.or('rsvp_status.eq.attending,rsvp_status.eq.confirmed');
        } else if (targetAudience === 'pending') {
            query = query.is('rsvp_status', null);
        } else if (targetAudience === 'declined') {
            query = query.eq('rsvp_status', 'declined');
        }

        // Get guests
        const { data: guests, error: guestsError } = await query;

        if (guestsError) throw guestsError;

        // 🗑️ CLEANUP: Delete previous pending/queued messages for this event and phase
        // to avoid duplication (the 48/46 issue)
        const { error: deleteError } = await supabase
            .from('whatsapp_messages')
            .delete()
            .eq('event_id', eventId)
            .eq('message_phase', messagePhase)
            .in('status', ['pending', 'queued']);

        if (deleteError) {
            console.warn('[Prepare] Warning deleting old messages:', deleteError);
        }

        // Prepare messages for each guest
        const messages = [];
        for (const guest of guests) {
            if (!guest.phone) continue; // Skip guests without phone

            const variables = getTemplateVariables(guest, event);
            const messageText = customMessage
                ? fillTemplate(customMessage, variables)
                : fillTemplate(template, variables);

            messages.push({
                event_id: eventId,
                guest_id: guest.id,
                phone: guest.phone,
                message_text: messageText,
                image_url: messagePhase === 'personalized' ? (guest.card_image_url || null) : null, // Only include card if personalized
                message_phase: messagePhase, // Track which phase this is
                status: 'pending'
            });
        }

        // Insert messages into database
        const { data, error } = await supabase
            .from('whatsapp_messages')
            .insert(messages)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            count: messages.length,
            messages: data,
            filteredBy: targetAudience
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/send-batch
 * Start batch sending
 */
app.post('/api/whatsapp/send-batch', async (req, res) => {
    try {
        const { eventId, mode = 'balanced' } = req.body;

        if (mode) {
            queueManager.applyMode(mode);
        }

        await queueManager.startSending(eventId);

        res.json({
            success: true,
            message: `Batch sending started in ${mode.toUpperCase()} mode`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/pause
 * Pause sending
 */
app.post('/api/whatsapp/pause', async (req, res) => {
    try {
        queueManager.pause();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/resume
 * Resume sending
 */
app.post('/api/whatsapp/resume', async (req, res) => {
    try {
        await queueManager.resume();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/whatsapp/stop
 * Stop sending
 */
app.post('/api/whatsapp/stop', async (req, res) => {
    try {
        queueManager.stop();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============= Status & Statistics =============

/**
 * GET /api/whatsapp/status/:eventId
 * Get sending status for an event
 */
app.get('/api/whatsapp/status/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const status = await queueManager.getStatus();

        res.json({ success: true, status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/whatsapp/stats/:accountId
 * Get statistics for a specific account
 */
app.get('/api/whatsapp/stats/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;

        // Get account details
        const { data: account, error: accountError } = await supabase
            .from('whatsapp_accounts')
            .select('*')
            .eq('id', accountId)
            .single();

        if (accountError) throw accountError;

        // Get message counts
        const { data: messages, error: messagesError } = await supabase
            .from('whatsapp_messages')
            .select('status')
            .eq('sender_account', account.phone);

        if (messagesError) throw messagesError;

        const stats = {
            total: messages.length,
            sent: messages.filter(m => m.status === 'sent').length,
            failed: messages.filter(m => m.status === 'failed').length,
            pending: messages.filter(m => m.status === 'pending').length
        };

        res.json({
            success: true,
            account,
            stats
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Debug route
app.get('/api/whatsapp/debug', (req, res) => {
    try {
        const clients = Array.from(whatsappService.clients.keys());
        const info = {
            activeClients: clients,
            queueStatus: {
                isRunning: queueManager.isRunning,
                isPaused: queueManager.isPaused,
                currentEventId: queueManager.currentEventId
            }
        };
        console.log('[DEBUG] State:', info);
        res.json({ success: true, info });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 WhatsApp API server running on port ${PORT}`);

    // Restore sessions on startup
    console.log('🔄 Restoring WhatsApp sessions...');
    try {
        const { data: accounts } = await supabase
            .from('whatsapp_accounts')
            .select('*')
            .eq('status', 'connected');

        if (accounts && accounts.length > 0) {
            console.log(`Found ${accounts.length} connected accounts. Re-initializing...`);
            for (const account of accounts) {
                console.log(`Restoring session for ${account.name} (${account.phone})...`);
                // Run in background to not block main thread loop event if one hangs
                whatsappService.initializeClient(account.id)
                    .catch(err => console.error(`Failed to restore ${account.name}:`, err));
            }
        } else {
            console.log('No active sessions to restore.');
        }
    } catch (error) {
        console.error('Error in session restoration:', error);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await whatsappService.disconnectAll();
    process.exit(0);
});

export default app;
