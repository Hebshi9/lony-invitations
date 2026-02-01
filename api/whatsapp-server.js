// WhatsApp API Routes
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import whatsappService from '../src/services/baileys-service.js';
import queueManager from '../src/services/queue-manager.js';
import { createClient } from '@supabase/supabase-js';
import { fillTemplate, getTemplateVariables } from '../src/services/message-templates.js';

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
