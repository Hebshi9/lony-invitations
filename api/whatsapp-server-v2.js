/**
 * Lony WhatsApp Server - Version 2.0 (MODULAR & CLEAN)
 * Focus: Meta Cloud API (Official)
 * Port: 3002 (Shadow Server)
 */
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

// Import Modular Services
import MetaService from './v2/services/MetaService.js';
import DatabaseService from './v2/services/DatabaseService.js';
import AIService from './v2/services/AIService.js';

const VERSION = '2.0.0-shadow';
const PORT = 3002;

const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// Log focus: Essential info only
app.use((req, res, next) => {
    if (req.url !== '/api/health') {
        console.log(`🚀 [V2] ${req.method} ${req.url}`);
    }
    next();
});

// --- CORE ROUTES ---

app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        version: VERSION, 
        mode: 'parallel_shadow',
        provider: 'Meta Cloud API',
        services: ['MetaService', 'DatabaseService', 'AIService']
    });
});

app.get('/api/health', (req, res) => {
    res.json({ success: true, time: new Date().toISOString() });
});

/**
 * Meta Sending Endpoint (Unified)
 * Handles text, images, and templates.
 */
app.post('/api/v2/meta/send', async (req, res) => {
    const { phone, text, imageUrl, templateName, variables, accountId } = req.body;

    if (!phone) return res.status(400).json({ success: false, error: 'Missing phone number' });

    console.log(`[V2] Sending Meta message to ${phone}...`);

    try {
        // 1. Send via Meta Service
        const result = await MetaService.sendMessage(phone, {
            text,
            imageUrl,
            templateName,
            variables
        });

        if (result.success) {
            // 2. Log to DB (Async, don't block response)
            DatabaseService.logSentMessage({
                phone,
                text: text || `Template: ${templateName}`,
                imageUrl,
                metaMessageId: result.messageId
                // guestId and eventId could be passed in req.body or looked up
            }).catch(e => console.error('[V2] DB Log Error:', e.message));

            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('[V2] Send Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Meta Webhook Endpoint
 * For delivery status and RSVP replies.
 */
app.post('/api/v2/meta/webhook', async (req, res) => {
    // 1. Respond quickly to Meta
    res.sendStatus(200);

    try {
        const parsed = MetaService.parseWebhook(req.body);
        if (!parsed) return;

        const { phone, text, buttonId } = parsed;
        console.log(`[V2 Webhook] 📩 Message from ${phone}: "${text}" (ButtonID: ${buttonId})`);

        // 2. Find Guest
        const { data: guest } = await DatabaseService.findGuestByPhone(phone);
        if (!guest) {
            console.log(`[V2 Webhook] ℹ️ No matching guest for ${phone}. Ignoring.`);
            return;
        }

        let rsvpStatus = null;

        // 3. Handle Button RSVP (Official Meta Flow)
        if (buttonId) {
            const cleanId = buttonId.toLowerCase();
            if (cleanId.includes('confirm') || cleanId.includes('accept')) {
                rsvpStatus = 'confirmed';
            } else if (cleanId.includes('decline') || cleanId.includes('cancel')) {
                rsvpStatus = 'declined';
            }
        }

        // 4. Update Database
        if (rsvpStatus) {
            console.log(`[V2 Webhook] ✅ Guest ${guest.name} -> ${rsvpStatus}`);
            await DatabaseService.updateRSVPStatus(guest.id, rsvpStatus);
            await DatabaseService.logReply({
                guestId: guest.id,
                eventId: guest.event_id,
                phone: phone,
                text: text || buttonId,
                rsvpStatus,
                confidence: 1.0
            });

            // 5. Automated Responses
            if (rsvpStatus === 'confirmed') {
                const replyText = `تم تأكيد حضورك يا ${guest.name} ✅\n\nهذا كرت الدخول الخاص بك. يرجى إبرازه عند الوصول 🌹`;
                
                // Send confirmation text
                await MetaService.sendMessage(phone, { text: replyText });

                // Send card image (barcode) if exists
                if (guest.card_image_url) {
                    console.log(`[V2 Webhook] 📬 Sending card to ${guest.name}...`);
                    await MetaService.sendMessage(phone, { 
                        imageUrl: guest.card_image_url,
                        caption: 'كرت الدخول الخاص بك 🌹'
                    });
                }
            } else if (rsvpStatus === 'declined') {
                const replyText = `تم قبول اعتذارك يا ${guest.name} 😔 نتمنى نشوفك في مناسبة قادمة 🌹`;
                await MetaService.sendMessage(phone, { text: replyText });
            }
        }
    } catch (error) {
        console.error('[V2 Webhook] ❌ Processing Error:', error.message);
    }
});

// Meta Webhook Verification (GET request from Facebook)
app.get('/api/v2/meta/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === (process.env.META_VERIFY_TOKEN || 'lony_secret')) {
            console.log('[V2 Webhook] ✅ Verified successfully');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Launch Shadow Server
app.listen(PORT, () => {
    console.log(`\n✅ Lony V2 SHADOW SERVER (Meta Only) is now running on http://localhost:${PORT}`);
    console.log(`🛡️  Independent of live system on 3001.\n`);
});
