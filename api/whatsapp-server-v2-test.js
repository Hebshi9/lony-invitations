/**
 * Lony WhatsApp Shadow Server - Version 2.1 (TEST/STAGING)
 * Focus: High Visibility & Reliability
 */
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Import Test Services
import MetaService from './v2/test/MetaService.js';
import DatabaseService from './v2/test/DatabaseService.js';

const VERSION = '2.1.0-shadow-test';
const PORT = 3012; // New port for testing

const app = express();
app.use(cors());
app.use(express.json());

// --- QUOTA CONFIG ---
const DAILY_LIMIT = 245;

app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        version: VERSION, 
        env: 'staging',
        quota_limit: DAILY_LIMIT
    });
});

/**
 * Enhanced Meta Sending Endpoint
 */
app.post('/api/v2/test/send', async (req, res) => {
    const { phone, text, imageUrl, templateName, variables } = req.body;

    // 1. Quota Check
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailySent } = await DatabaseService.client
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday);
    
    if ((dailySent || 0) >= DAILY_LIMIT) {
        return res.status(429).json({ 
            success: false, 
            error: `DAILY QUOTA REACHED (${dailySent}/${DAILY_LIMIT}). Please wait 24h.` 
        });
    }

    try {
        const result = await MetaService.sendMessage(phone, {
            text, imageUrl, templateName, variables
        });

        if (result.success) {
            await DatabaseService.logSentMessage({
                phone,
                text: text || `Template: ${templateName}`,
                imageUrl,
                metaMessageId: result.messageId
            });
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Granular Webhook Handler
 */
app.post('/api/v2/test/webhook', async (req, res) => {
    res.sendStatus(200);

    try {
        const parsed = MetaService.parseWebhook(req.body);
        if (!parsed) return;

        // --- CASE 1: Status Update (Delivered/Read/Failed) ---
        if (parsed.type === 'status') {
            console.log(`[Shadow Webhook] 📊 Status Update: ${parsed.messageId} -> ${parsed.status}`);
            await DatabaseService.updateDeliveryStatus(parsed.messageId, parsed.status, parsed.errors);
            return;
        }

        // --- CASE 2: Incoming Message/Button ---
        if (parsed.type === 'message') {
            const { phone, text, buttonId } = parsed;
            console.log(`[Shadow Webhook] 📩 Message from ${phone}: "${text}"`);

            const { data: guest } = await DatabaseService.findGuestByPhone(phone);
            if (!guest) return;

            // Handle Bridge Logic or RSVP...
            // (Same as V2 but with test services)
        }
    } catch (error) {
        console.error('[Shadow Webhook] ❌ Error:', error.message);
    }
});

// Webhook Verification
app.get('/api/v2/test/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === 'lony_test_secret') {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 [Shadow Server] Running on http://localhost:${PORT}`);
});
