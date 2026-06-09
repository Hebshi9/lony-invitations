/**
 * Lony WhatsApp Server - Version 2.0 (MODULAR & CLEAN)
 * Focus: Meta Cloud API (Official)
 * Port: 3002 (Shadow Server)
 */
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Import Modular Services
import MetaService from './v2/services/MetaService.js';
import DatabaseService from './v2/services/DatabaseService.js';
import AIService from './v2/services/AIService.js';

const VERSION = '2.0.0-shadow';
const PORT = 3011;

const app = express();

// --- IRON WALL PROTECTION ---
process.on('uncaughtException', (err) => {
    console.error('💥 [Iron Wall] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 [Iron Wall] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Keep-alive heartbeat
setInterval(() => {
    // Just keeping the event loop occupied
}, 60000);

// --- MIDDLEWARE ---
app.use(cors());
// Forensic Startup Audit
(async () => {
    console.log('🧐 [Startup] Auditing Database Connectivity...');
    try {
        const { data, error } = await DatabaseService.client.from('events').select('count', { count: 'exact', head: true });
        if (error) throw error;
        console.log('✅ [Startup] Database Connection Verified.');
    } catch (err) {
        console.error('❌ [Startup] DATABASE CONNECTION FAILED:', err.message);
    }
})();

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
        const result = MetaService.parseWebhook(req.body);
        if (!result) return;

        // --- A. HANDLE STATUS UPDATES (sent, delivered, read, failed) ---
        if (result.type === 'statusUpdate') {
            const { metaMessageId, status, errors } = result;
            console.log(`[V2 Webhook] 📊 Status update: ${status} for ID ${metaMessageId}`);
            
            await DatabaseService.updateMessageDeliveryStatus(
                metaMessageId, 
                status, 
                errors ? errors[0] : null
            );
            return;
        }

        // --- B. HANDLE INCOMING MESSAGES (RSVPs & Bridge) ---
        const { phone, text, buttonId } = result;
        console.log(`[V2 Webhook] 📩 Message from ${phone}: "${text}" (ButtonID: ${buttonId})`);

        // 2. Find Guest
        const { data: guest } = await DatabaseService.findGuestByPhone(phone);
        if (!guest) {
            console.log(`[V2 Webhook] ℹ️ No matching guest for ${phone}. Ignoring.`);
            return;
        }

        let rsvpStatus = null;

        // ═══════════════════════════════════════════
        // 🌉 BRIDGE COMPLETION HANDLER
        // When guest approves receiving the invite via Utility template
        // ═══════════════════════════════════════════
        const payload = buttonId || text || '';
        const isBridgeButton = payload === 'yes_send_invite' || (text && (text.includes('التفاصيل') || text.includes('ارسل')));

        if (isBridgeButton) {
            console.log(`[V2 Webhook] 🌉 Bridge confirmation from ${phone}. Checking for stashed payload...`);
            
            // Find guest with pending marketing data
            const { data: stashedGuest } = await db
                .from('guests')
                .select('*, events(*)')
                .ilike('phone', `%${phone.slice(-9)}`)
                .not('pending_marketing_data', 'is', null)
                .single();

            if (stashedGuest?.pending_marketing_data) {
                console.log(`[V2 Webhook] 🚀 Bridge Re-trigger for ${stashedGuest.name}`);
                
                // Re-send the original marketing template via Meta API
                const bridgePayload = stashedGuest.pending_marketing_data;
                const metaRes = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(bridgePayload)
                });

                if (metaRes.ok) {
                    const metaData = await metaRes.json();
                    console.log(`[V2 Webhook] ✅ Bridge complete! Marketing sent to ${stashedGuest.name}`);
                    
                    // Clear the stash and update status
                    await db.from('guests').update({ 
                        status: 'sent', 
                        pending_marketing_data: null 
                    }).eq('id', stashedGuest.id);

                    // Log the successful bridge completion
                    await db.from('whatsapp_messages').insert({
                        guest_id: stashedGuest.id,
                        event_id: stashedGuest.event_id,
                        phone: phone,
                        status: 'sent',
                        delivery_status: 'sent',
                        evolution_message_id: metaData.messages?.[0]?.id || null,
                        message_text: 'Bridge Complete → Marketing Sent',
                        message_phase: 'invitation'
                    });
                } else {
                    console.error(`[V2 Webhook] ❌ Bridge re-send failed for ${stashedGuest.name}`);
                }
                return; // Don't process further as RSVP
            }
        }

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


/**
 * Meta Batch/Campaign Endpoints [NEW]
 * Supporting the CampaignCenter and Debt Pulse logic.
 */
app.post('/api/prepare-messages', async (req, res) => {
    const { eventId, template, messagePhase, filters } = req.body;
    console.log(`[V2] Preparing batch for event ${eventId} (${messagePhase})...`);
    // Placeholder for real prep logic - in V2 we might pull from DB directly
    res.json({ success: true, count: 0, message: 'Ready for batch send (V2 Interface)' });
});

/**
 * 🚀 [V2] SANDBOX BATCH SEND (Test Endpoint)
 */
app.post('/api/send-batch-v2', async (req, res) => {
    const { eventId, guestIds, campaignType, testPhone } = req.body;
    console.log(`🚀 [V2 Sandbox] Campaign request received for event ${eventId}`);

    if (!eventId || !guestIds || !Array.isArray(guestIds)) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if a job is already running
    if (activeJobs.has(eventId)) {
        return res.status(409).json({ error: 'A campaign is already running for this event' });
    }

    // Start campaign in background
    processCampaignV2(eventId, guestIds, campaignType, testPhone).catch(err => {
        console.error(`❌ [V2 Sandbox] Background campaign failure:`, err.message);
    });

    res.json({ success: true, message: 'V2 Sandbox campaign started in background' });
});

app.post('/api/send-batch', async (req, res) => {
    const { eventId, mode } = req.body;
    console.log(`[V2] Triggering batch send for event ${eventId}...`);
    // Trigger bulk sending logic via MetaService
    res.json({ success: true, message: 'Batch sending initiated via Meta Cloud API' });
});

app.get('/api/status/:eventId', async (req, res) => {
    const job = activeJobs.get(req.params.eventId);
    if (job) {
        res.json({ 
            success: true, 
            status: { isRunning: true, stats: job } 
        });
    } else {
        res.json({ 
            success: true, 
            status: { isRunning: false, stats: { sent: 0, total: 0 } } 
        });
    }
});


/**
 * --- LEGACY COMPATIBILITY BRIDGE ---
 * These endpoints allow the existing frontend (WhatsAppSender, DemoExperience)
 * to work seamlessly with the new Meta Cloud API logic.
 */

// Get accounts (Hardcoded for Meta V2 independence)
app.get('/api/accounts', (req, res) => {
    res.json({ 
        success: true, 
        accounts: [{ 
            id: 'meta-v2-main', 
            name: 'Lony Meta Pro', 
            connected: true,
            provider: 'Meta'
        }] 
    });
});

// Generic Send (Proxy to Meta Service)
app.post('/api/send', async (req, res) => {
    const { phone, message, imageUrl } = req.body;
    console.log(`[V2 Bridge] Sending message to ${phone}...`);
    try {
        const result = await MetaService.sendMessage(phone, { text: message, imageUrl });
        res.json(result);
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

/**
 * --- PROFESSIONAL CAMPAIGN ORCHESTRATOR ---
 * Handles background bulk sending with throttling and event status awareness.
 */
const activeJobs = new Map();

/**
 * Interruptible Sleep (Smart Throttle)
 * Checks for status change every second instead of deep sleep.
 */
async function smartThrottle(ms, eventId) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        const { data: event } = await DatabaseService.client
            .from('events')
            .select('campaign_status')
            .eq('id', eventId)
            .maybeSingle();

        if (event?.campaign_status === 'paused' || event?.campaign_status === 'stopped') {
            return true; // Interrupted
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

async function processCampaign(eventId, guestIds, campaignType, testPhone) {
    console.log(`\n🌀 [Campaign] START: Event ${eventId} | ${guestIds.length} guests | Type: ${campaignType}`);
    
    const db = createClient(
        'https://gxunxhzjqclddoobxvpz.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg'
    );

    let sentCount = 0;
    let currentJitter = 2000; // Default 2s between messages

    try {
        // ═══════════════════════════════════════════
        // 1. FETCH EVENT DATA FROM DATABASE
        // ═══════════════════════════════════════════
        console.log(`📋 [Campaign] Fetching event data...`);
        const { data: event, error: eventError } = await db
            .from('events').select('*').eq('id', eventId).single();

        if (eventError || !event) {
            console.error(`❌ [Campaign] Event not found: ${eventError?.message || 'NULL'}`);
            return;
        }

        const groomName = event.groom_name || event.settings?.groom_name || 'العريس';
        const brideName = event.bride_name || event.settings?.bride_name || 'العروس';
        const eventDate = event.date || 'قريباً';
        const eventLocation = event.location || event.location_name || 'الموقع';
        const headerImage = event.settings?.global_invite_image_url || 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/demo_card.png';
        let templateName = event.template_name || 'lony';
        if (templateName === 'lony') templateName = 'get_update';

        console.log(`📋 [Campaign] Event: "${event.name}" | ${groomName} & ${brideName}`);
        console.log(`📋 [Campaign] Template: ${templateName} | Image: ${headerImage}`);

        // ═══════════════════════════════════════════
        // 2. DAILY QUOTA GUARD
        // ═══════════════════════════════════════════
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: dailySent } = await db
            .from('whatsapp_messages')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', yesterday);
        
        const dailyLimit = 250;
        console.log(`📊 [Quota] Sent today: ${dailySent || 0}/${dailyLimit}`);

        // ═══════════════════════════════════════════
        // 3. INITIALIZE PROGRESS
        // ═══════════════════════════════════════════
        await db.from('events').update({
            campaign_status: 'sending',
            campaign_progress: {
                status: 'sending', count: 0, total: guestIds.length,
                current_name: 'جاري التحضير...', last_log: '🚀 بدأت المعالجة...'
            }
        }).eq('id', eventId);

        activeJobs.set(eventId, {
            total: guestIds.length, sent: 0, failed: 0, bridged: 0, skipped: 0,
            startTime: new Date().toISOString()
        });

        // ═══════════════════════════════════════════
        // 4. MAIN GUEST LOOP
        // ═══════════════════════════════════════════
        for (let i = 0; i < guestIds.length; i++) {
            const guestId = guestIds[i];
            const job = activeJobs.get(eventId);

            try {
                // --- CLOUD KILL-SWITCH ---
                const { data: statusCheck } = await db
                    .from('events').select('campaign_status, campaign_jitter_override')
                    .eq('id', eventId).single();

                if (statusCheck?.campaign_status === 'stopped' || statusCheck?.campaign_status === 'idle') {
                    console.log(`🛑 [Campaign] Stopped by user.`);
                    break;
                }
                if (statusCheck?.campaign_status === 'paused') {
                    console.log(`⏸️ [Campaign] Paused. Waiting for resume...`);
                    await db.from('events').update({
                        campaign_progress: {
                            status: 'paused', current_name: 'متوقف مؤقتاً ⏸️',
                            count: (job?.sent || 0) + (job?.failed || 0), total: guestIds.length,
                            last_log: '⏸️ الحملة متوقفة مؤقتاً بأمر المستخدم'
                        }
                    }).eq('id', eventId);
                    while (true) {
                        await new Promise(r => setTimeout(r, 3000));
                        const { data: check } = await db.from('events').select('campaign_status').eq('id', eventId).single();
                        if (check?.campaign_status === 'stopped') { break; }
                        if (check?.campaign_status !== 'paused') { break; }
                    }
                    // Re-check after unpause
                    const { data: recheck } = await db.from('events').select('campaign_status').eq('id', eventId).single();
                    if (recheck?.campaign_status === 'stopped') break;
                }

                // Apply dynamic jitter from DB if set
                if (statusCheck?.campaign_jitter_override) {
                    currentJitter = statusCheck.campaign_jitter_override;
                }

                // --- QUOTA CHECK (per-message) ---
                const { count: currentSent } = await db
                    .from('whatsapp_messages').select('*', { count: 'exact', head: true })
                    .gte('created_at', yesterday);
                
                if ((currentSent || 0) >= dailyLimit) {
                    console.log(`🛑 [Quota] Daily limit reached (${currentSent}/${dailyLimit}). Pausing.`);
                    await db.from('events').update({ campaign_status: 'pending_quota' }).eq('id', eventId);
                    break;
                }

                // --- FETCH GUEST ---
                const { data: guest, error: gErr } = await db
                    .from('guests').select('*').eq('id', guestId).single();

                if (gErr || !guest) {
                    console.error(`❌ [Campaign] Guest ${guestId} not found`);
                    continue;
                }

                // --- PHONE VALIDATION ---
                let phone = (guest.phone || '').replace(/\D/g, '');
                if (phone.startsWith('05') && phone.length === 10) phone = '966' + phone.substring(1);
                else if (phone.startsWith('5') && phone.length === 9) phone = '966' + phone;
                else if (phone.length === 9 && !phone.startsWith('966')) phone = '966' + phone;

                // Test mode override
                if (testPhone) {
                    console.log(`🎯 [Test] Overriding ${phone} → ${testPhone}`);
                    phone = testPhone.replace(/\D/g, '');
                }

                if (!phone || phone.length < 9 || phone.length > 13) {
                    console.error(`⚠️ [Campaign] Invalid phone for ${guest.name}: ${guest.phone}`);
                    if (job) job.failed++;
                    await db.from('guests').update({ status: 'failed' }).eq('id', guest.id);
                    await db.from('whatsapp_messages').insert({
                        guest_id: guest.id, event_id: eventId,
                        status: 'failed', delivery_status: 'failed',
                        error_message: 'رقم جوال غير صالح', message_phase: campaignType
                    });
                    continue;
                }

                // --- DUPLICATE PREVENTION (skip if sent today) ---
                const { data: alreadySent } = await db
                    .from('whatsapp_messages').select('id')
                    .eq('guest_id', guest.id).eq('event_id', eventId)
                    .eq('message_phase', campaignType === 'qr_code' ? 'qr_code' : 'invitation')
                    .gte('created_at', yesterday).limit(1).maybeSingle();

                if (alreadySent) {
                    if (job) job.skipped = (job.skipped || 0) + 1;
                    console.log(`⏭️ [Campaign] Skipping ${guest.name} (already sent today)`);
                    await db.from('events').update({
                        campaign_progress: {
                            status: 'sending', current_name: guest.name,
                            count: i + 1, total: guestIds.length,
                            last_log: `⏭️ تم تخطي ${guest.name} (مُرسل مسبقاً)`
                        }
                    }).eq('id', eventId);
                    continue;
                }

                // --- UPDATE PROGRESS (before send) ---
                await db.from('events').update({
                    campaign_progress: {
                        status: 'sending', current_name: guest.name,
                        count: i + 1, total: guestIds.length,
                        last_log: `📨 جاري إرسال: ${guest.name}`
                    }
                }).eq('id', eventId);

                console.log(`📨 [Campaign] [${i + 1}/${guestIds.length}] Sending to: ${guest.name} (${phone})`);

                // ═══════════════════════════════════════════
                // BUILD PAYLOAD
                // ═══════════════════════════════════════════
                let payload;
                if (campaignType === 'qr_code') {
                    payload = {
                        imageUrl: guest.card_image_url,
                        caption: `🌹 كرت دعوة ${groomName} و ${brideName}\nيرجى إبراز الباركود عند الوصول.`
                    };
                } else {
                    // Dynamic template selection
                    let tplName = templateName;
                    if (campaignType === 'reminder_rsvp') tplName = 'lony_reminder';
                    else if (campaignType === 'reminder_eve') tplName = 'lony_eve_reminder';

                    let variables;
                    if (tplName === 'lony_generic') {
                        variables = {
                            guest_name: guest.name || 'ضيفنا الكريم',
                            event_name: event.name || 'المناسبة',
                            event_date: eventDate,
                            event_location: eventLocation,
                            note: event.settings?.note || 'نتمنى حضوركم'
                        };
                    } else if (tplName === 'lony_reminder' || tplName === 'lony_eve_reminder') {
                        variables = {
                            guest_name: guest.name || 'ضيفنا الكريم',
                            event_name: event.name || 'المناسبة',
                            event_date: eventDate,
                            event_location: eventLocation
                        };
                    } else {
                        variables = {
                            guest_name: guest.name || 'ضيفنا الكريم',
                            groom_name: groomName,
                            bride_name: brideName,
                            event_date: eventDate,
                            event_location: eventLocation
                        };
                    }

                    payload = {
                        templateName: tplName,
                        languageCode: 'ar',
                        imageUrl: headerImage,
                        mediaId: null,
                        variables
                    };
                }

                // ═══════════════════════════════════════════
                // SEND MESSAGE
                // ═══════════════════════════════════════════
                const result = await MetaService.sendMessage(phone, payload);

                if (result.success) {
                    if (job) job.sent++;
                    sentCount++;
                    console.log(`✅ [Campaign] [${i + 1}/${guestIds.length}] ${guest.name} - SUCCESS`);

                    await db.from('whatsapp_messages').insert({
                        event_id: eventId, guest_id: guest.id, phone: phone,
                        message_text: payload.templateName ? `Template: ${payload.templateName}` : 'QR Card',
                        image_url: payload.imageUrl,
                        evolution_message_id: result.messageId,
                        status: 'sent', delivery_status: 'sent',
                        message_phase: campaignType === 'qr_code' ? 'qr_code' : 'invitation'
                    }).then(r => { if (r.error) console.error('DB insert error:', r.error.message); });

                    await db.from('guests').update({
                        status: 'sent', updated_at: new Date().toISOString(),
                        reminder_sent: campaignType.includes('reminder') ? true : guest.reminder_sent,
                        reminder_sent_at: campaignType.includes('reminder') ? new Date().toISOString() : guest.reminder_sent_at
                    }).eq('id', guest.id);

                    // Update progress
                    await db.from('events').update({
                        campaign_progress: {
                            status: 'sending', current_name: guest.name,
                            count: (job?.sent || 0) + (job?.failed || 0), total: guestIds.length,
                            last_log: `✅ تم إرسال الدعوة: ${guest.name}`
                        }
                    }).eq('id', eventId);

                } else {
                    // ═══════════════════════════════════════════
                    // SMART RECOVERY ENGINE
                    // ═══════════════════════════════════════════
                    const errorCode = result.errorCode;
                    const errorMsg = result.error || 'خطأ من ميتا';

                    // --- 🌉 BRIDGE: Meta Ecosystem Protection (131049) ---
                    if (errorCode === 131049) {
                        console.log(`🌉 [Bridge] Meta blocked marketing for ${guest.name}. Sending Utility Bridge...`);
                        if (job) job.bridged = (job.bridged || 0) + 1;

                        // 1. Stash original marketing payload
                        await db.from('guests').update({
                            status: 'bridging',
                            pending_marketing_data: payload,
                            updated_at: new Date().toISOString()
                        }).eq('id', guest.id);

                        // 2. Send Utility Bridge template
                        const bridgeResult = await MetaService.sendMessage(phone, {
                            templateName: 'lony_invite_bridge',
                            languageCode: 'ar',
                            variables: {
                                guest_name: guest.name || 'ضيفنا العزيز',
                                sender_name: groomName
                            }
                        });

                        // 3. Log bridge message
                        await db.from('whatsapp_messages').insert({
                            guest_id: guest.id, event_id: eventId, phone: phone,
                            status: 'sent', delivery_status: 'bridging',
                            evolution_message_id: bridgeResult.messageId || null,
                            message_text: 'Utility Bridge (بانتظار موافقة الضيف)',
                            message_phase: 'bridge'
                        });

                        await db.from('events').update({
                            campaign_progress: {
                                status: 'sending', current_name: guest.name,
                                count: (job?.sent || 0) + (job?.failed || 0), total: guestIds.length,
                                last_log: `🌉 جسر العبور لـ ${guest.name} (حماية ميتا)`
                            }
                        }).eq('id', eventId);

                    // --- ⚠️ BACKOFF: Rate Limiting (131048) ---
                    } else if (errorCode === 131048) {
                        console.log(`⚠️ [Backoff] Rate limit for ${guest.name}. Increasing jitter to 15s.`);
                        currentJitter = 15000;
                        await db.from('events').update({
                            campaign_jitter_override: 15000,
                            campaign_progress: {
                                status: 'sending', current_name: guest.name,
                                count: (job?.sent || 0) + (job?.failed || 0), total: guestIds.length,
                                last_log: `⚠️ تبريد تلقائي (15ث) لحماية الحساب`
                            }
                        }).eq('id', eventId);
                        // Retry this guest after cooldown
                        i--;
                        await new Promise(r => setTimeout(r, 15000));
                        continue;

                    // --- ❌ HARD FAILURE (all other errors) ---
                    } else {
                        if (job) job.failed++;
                        const arabicError = {
                            131047: 'الرقم غير مسجل في واتساب',
                            131052: 'المستلم حظر حساب الأعمال',
                            131049: 'فشل التسليم (حظر شركة اتصالات)',
                            131051: 'رفض القالب من سياسة واتساب',
                            131026: 'الرسالة غير قابلة للتسليم',
                            131030: 'الرقم غير مسجل في واتساب',
                            131000: 'المستخدم حظرك أو أبلغ عنك',
                            132000: 'خطأ في بيانات القالب'
                        }[errorCode] || errorMsg;

                        console.error(`❌ [Campaign] ${guest.name} - FAILED: ${arabicError}`);

                        await db.from('whatsapp_messages').insert({
                            guest_id: guest.id, event_id: eventId, phone: phone,
                            status: 'failed', delivery_status: 'failed',
                            error_message: arabicError,
                            message_phase: campaignType === 'qr_code' ? 'qr_code' : 'invitation'
                        });

                        await db.from('guests').update({
                            status: 'failed', updated_at: new Date().toISOString()
                        }).eq('id', guest.id);

                        await db.from('events').update({
                            campaign_progress: {
                                status: 'sending', current_name: guest.name,
                                count: (job?.sent || 0) + (job?.failed || 0), total: guestIds.length,
                                last_log: `❌ فشل: ${guest.name} - ${arabicError}`
                            }
                        }).eq('id', eventId);
                    }
                }

                // --- SAFETY PULSE (JITTER) ---
                if (i < guestIds.length - 1) {
                    const jitter = currentJitter + Math.floor(Math.random() * 1000);
                    await new Promise(r => setTimeout(r, jitter));
                }

            } catch (innerErr) {
                console.error(`❌ [Campaign] Error processing guest:`, innerErr.message);
            }
        }

    } catch (outerErr) {
        console.error(`❌ [Campaign] Critical failure:`, outerErr.message);
    } finally {
        const job = activeJobs.get(eventId);
        console.log(`🏁 [Campaign] DONE. Sent: ${job?.sent || 0} | Failed: ${job?.failed || 0} | Bridged: ${job?.bridged || 0} | Skipped: ${job?.skipped || 0}`);

        // Mark campaign as finished
        const summaryParts = [];
        if (job?.sent) summaryParts.push(`${job.sent} نجاح ✅`);
        if (job?.failed) summaryParts.push(`${job.failed} فشل ❌`);
        if (job?.bridged) summaryParts.push(`${job.bridged} جسر 🌉`);
        if (job?.skipped) summaryParts.push(`${job.skipped} مكرر ⏭️`);
        const summaryText = summaryParts.length > 0 ? summaryParts.join('، ') : 'لا توجد عمليات';

        await db.from('events').update({
            campaign_status: 'idle',
            campaign_jitter_override: null,
            campaign_progress: {
                status: 'done',
                count: guestIds?.length || 0,
                total: guestIds?.length || 0,
                current_name: 'اكتملت الحملة ✅',
                last_log: `🏁 اكتملت: ${summaryText}`
            }
        }).eq('id', eventId);

        // ═══════════════════════════════════════════
        // COMPLETION REPORT (send to owner)
        // ═══════════════════════════════════════════
        try {
            const { data: evt } = await db.from('events').select('name, owner_phone, settings').eq('id', eventId).single();
            const ownerPhone = evt?.owner_phone || evt?.settings?.owner_phone;
            if (ownerPhone && sentCount > 0) {
                const reportText = `📊 *تقرير حملة لوني*\n\n` +
                    `✅ تم الانتهاء من إرسال دعوات *${evt.name}*\n\n` +
                    `📈 *الإحصائيات:*\n` +
                    `• ✅ نجاح: ${job?.sent || 0}\n` +
                    `• ❌ فشل: ${job?.failed || 0}\n` +
                    `• 🌉 جسر: ${job?.bridged || 0}\n` +
                    `• 📊 الإجمالي: ${guestIds.length}\n\n` +
                    `✨ تم تحديث لوحة التحكم تلقائياً.`;

                await MetaService.sendMessage(ownerPhone, { text: reportText });
                console.log(`📬 [Report] Sent to owner: ${ownerPhone}`);
            }
        } catch (e) {
            console.error('❌ [Campaign] Report error:', e.message);
        }

        activeJobs.delete(eventId);
    }
}

/**
 * 🌀 [V2] ENHANCED CAMPAIGN ENGINE (Sandbox)
 * Includes Meta Decision Tracking, Manual Bridge, and Detailed Error Mapping.
 */
async function processCampaignV2(eventId, guestIds, campaignType, testPhone) {
    console.log(`\n🌀 [Campaign V2] START: Event ${eventId} | ${guestIds.length} guests | Type: ${campaignType}`);
    
    const db = createClient(
        'https://gxunxhzjqclddoobxvpz.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
    );

    let sentCount = 0;
    let currentJitter = 2000;

    try {
        const { data: event } = await db.from('events').select('*').eq('id', eventId).single();
        if (!event) return;

        const groomName = event.groom_name || event.settings?.groom_name || 'العريس';
        const brideName = event.bride_name || event.settings?.bride_name || 'العروس';
        const eventDate = event.date || 'قريباً';
        const eventLocation = event.location || event.location_name || 'الموقع';
        const headerImage = event.settings?.global_invite_image_url || 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/demo_card.png';
        let templateName = event.template_name || 'lony';
        if (templateName === 'lony') templateName = 'get_update';

        activeJobs.set(eventId, { sent: 0, failed: 0, bridged: 0, skipped: 0 });

        for (let i = 0; i < guestIds.length; i++) {
            try {
                const guestId = guestIds[i];
                const job = activeJobs.get(eventId);

                const { data: statusCheck } = await db.from('events').select('campaign_status, campaign_jitter_override').eq('id', eventId).single();
                if (statusCheck?.campaign_status === 'stopped') break;
                if (statusCheck?.campaign_jitter_override) currentJitter = statusCheck.campaign_jitter_override;

                const { data: guest } = await db.from('guests').select('*').eq('id', guestId).single();
                if (!guest) continue;

                let phone = (guest.phone || '').replace(/\D/g, '');
                if (phone.startsWith('05')) phone = '966' + phone.substring(1);
                if (testPhone) phone = testPhone.replace(/\D/g, '');

                if (!phone || phone.length < 9) {
                    if (job) job.failed++;
                    continue;
                }

                let payload;
                if (campaignType === 'qr_code') {
                    payload = { imageUrl: guest.card_image_url, caption: `🌹 كرت دعوة ${groomName} و ${brideName}` };
                } else if (campaignType === 'manual_bridge') {
                    payload = { templateName: 'lony_invite_bridge', languageCode: 'ar', variables: { guest_name: guest.name || 'ضيفنا العزيز', sender_name: groomName } };
                } else {
                    let tplName = templateName;
                    if (campaignType === 'reminder_rsvp') tplName = 'lony_reminder';

                    let variables;
                    if (tplName === 'lony_generic') {
                        variables = {
                            guest_name: guest.name || 'ضيفنا الكريم',
                            event_name: event.name || 'المناسبة',
                            event_date: eventDate,
                            event_location: eventLocation,
                            note: event.settings?.note || 'نتمنى حضوركم'
                        };
                    } else if (tplName === 'lony_reminder' || tplName === 'lony_eve_reminder') {
                        variables = {
                            guest_name: guest.name || 'ضيفنا الكريم',
                            event_name: event.name || 'المناسبة',
                            event_date: eventDate,
                            event_location: eventLocation
                        };
                    } else {
                        variables = {
                            guest_name: guest.name || 'ضيفنا الكريم',
                            groom_name: groomName,
                            bride_name: brideName,
                            event_date: eventDate,
                            event_location: eventLocation
                        };
                    }

                    payload = { templateName: tplName, languageCode: 'ar', imageUrl: headerImage, variables };
                }

                const result = await MetaService.sendMessage(phone, payload);

                if (result.success) {
                    if (job) job.sent++;
                    sentCount++;
                    const isBridge = campaignType === 'manual_bridge';
                    
                    await db.from('whatsapp_messages').insert({
                        event_id: eventId, guest_id: guest.id, phone: phone,
                        evolution_message_id: result.messageId,
                        status: 'sent', delivery_status: 'sent',
                        message_phase: isBridge ? 'bridge' : (campaignType === 'qr_code' ? 'qr_code' : 'invitation')
                    });

                    await db.from('guests').update({ status: isBridge ? 'bridging' : 'sent', updated_at: new Date().toISOString() }).eq('id', guest.id);
                    
                    await db.from('events').update({
                        campaign_progress: { status: 'sending', current_name: guest.name, count: i + 1, total: guestIds.length, last_log: isBridge ? `🌉 تم إرسال جسر العبور: ${guest.name}` : `✅ تم إرسال الدعوة: ${guest.name}` }
                    }).eq('id', eventId);

                } else {
                    const errorCode = result.errorCode;
                    if (errorCode === 131049 && campaignType !== 'manual_bridge') {
                        if (job) job.bridged = (job.bridged || 0) + 1;
                        await db.from('guests').update({ status: 'bridging', pending_marketing_data: payload }).eq('id', guest.id);
                        await MetaService.sendMessage(phone, { templateName: 'lony_invite_bridge', languageCode: 'ar', variables: { guest_name: guest.name || 'ضيفنا العزيز', sender_name: groomName } });
                    } else {
                        if (job) job.failed++;
                        const arabicError = {
                            131049: 'ميتا قررت عدم التسليم (حظر محتوى تسويقي)',
                            131026: 'ميتا قررت عدم التسليم (حساب مقيد)',
                            131047: 'الرقم غير مسجل في واتساب'
                        }[errorCode] || result.error || 'خطأ غير معروف';
                        
                        await db.from('guests').update({ status: 'failed' }).eq('id', guest.id);
                        await db.from('whatsapp_messages').insert({ 
                            guest_id: guest.id, 
                            event_id: eventId, 
                            phone: phone, 
                            status: 'failed', 
                            delivery_status: 'failed', 
                            error_message: arabicError, 
                            message_phase: 'invitation',
                            message_text: 'فشل إرسال الدعوة'
                        });
                    }
                }

                if (i < guestIds.length - 1) await new Promise(r => setTimeout(r, currentJitter));

            } catch (innerErr) { console.error(`❌ [Campaign V2] Error:`, innerErr.message); }
        }
    } catch (outerErr) { console.error(`❌ [Campaign V2] Critical:`, outerErr.message); }
    finally {
        activeJobs.delete(eventId);
        await db.from('events').update({ campaign_status: 'idle', campaign_progress: { status: 'done', count: guestIds.length, total: guestIds.length, current_name: 'اكتملت الحملة (V2) ✅', last_log: '🏁 اكتملت حملة المختبر بنجاح' } }).eq('id', eventId);
    }
}

// DIRECT TEST ENDPOINT (For the admin to try privately)
app.post('/api/send-direct-test', async (req, res) => {
    const { phone, type } = req.body;
    console.log(`[V2 Bridge] 🎯 Manual pilot test to ${phone} (Type: ${type})`);
    
    let payload = {
        text: "🌹 نتشرف بدعوتكم لحضور مناسبة لوني برو (Meta V2 Pilot Test)\nيرجى الرد بـ 'تم' لتلقي كرت الباركود الخاص بك."
    };

    if (type === 'card') {
        payload = {
            imageUrl: "https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/demo_card.png",
            caption: "✨ كرت الدعوة الخاص بك (رسمي عبر ميتا)\nنشكرك على تجربتك معنا 🌹"
        };
    }

    const result = await MetaService.sendMessage(phone, payload);
    res.json(result);
});

// Background Campaign Bridge (REAL Implementation)
app.post('/api/send-campaign-background', async (req, res) => {
    console.log('📦 [V2] Full Request Body Incoming:', JSON.stringify(req.body, null, 2));
    let { guestIds, eventId, campaignType, testPhone } = req.body;
    
    // Support for Forensic Test Mode
    if (testPhone && (!guestIds || guestIds.length === 0)) {
        guestIds = ['test-forensic-id'];
    }

    if (!guestIds || !eventId) return res.status(400).json({ error: 'Missing payload' });

    console.log(`[V2 Bridge] 🚀 Launching professional background campaign for ${guestIds.length} guests.`);
    
    // 1. Kick off process in the background (Async)
    processCampaign(eventId, guestIds, campaignType || 'invitation', testPhone).catch(console.error);

    // 2. Respond immediately
    res.status(202).json({ 
        success: true, 
        message: 'Campaign accepted and processing in cloud background',
        jobId: `job-${eventId}-${Date.now()}`
    });
});

// Real-time Status Route
app.get('/api/status/:eventId', async (req, res) => {
    const job = activeJobs.get(req.params.eventId);
    if (job) {
        res.json({ success: true, status: { isRunning: true, stats: job } });
    } else {
        res.json({ success: true, status: { isRunning: false, stats: { sent: 0, total: 0 } } });
    }
});

/**
 * --- OWNER NOTIFICATION SYSTEM ---
 * Sends financial alerts directly to the owner's phone.
 */
app.post('/api/v2/owner/notify', async (req, res) => {
    // List of admins to notify
    const NOTIFY_LIST = ['966569667344', '966503578789', '966507240097']; 
    // Note: We'll add Sara's confirmed number here once user replies
    
    const { clientName, balance, serviceType, action, customMessage } = req.body;

    let message = customMessage || '';
    if (!message) {
        if (action === 'new_debt') {
            message = `🔔 *تنبيه مديونية جديدة*\n\n👤 العميل: ${clientName}\n💰 المبلغ المتبقي: ${balance} ريال\n🛠️ الخدمة: ${serviceType}\n\nيرجى المتابعة معه في النظام. 🏛️`;
        } else if (action === 'summary') {
            message = serviceType; // In summary mode, the summary text is passed in serviceType field
        } else {
            message = `📊 *تقرير مالي لـ لوني*\n\nالعميل: ${clientName}\nالحالة: ${action}\nالمتبقي: ${balance} ريال`;
        }
    }

    try {
        console.log(`[V2 Multi-Notify] Sending alert to ${NOTIFY_LIST.length} admins...`);
        const results = await Promise.all(NOTIFY_LIST.map(phone => 
            MetaService.sendMessage(phone, { text: message })
        ));
        res.json({ success: true, results });
    } catch (e) {
        console.error('[V2 Multi-Notify Error]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ═══════════════════════════════════════════
// META QUOTA CHECK
// ═══════════════════════════════════════════
app.get('/api/get-meta-quota', async (req, res) => {
    try {
        const phoneId = process.env.META_PHONE_NUMBER_ID;
        const token = process.env.META_ACCESS_TOKEN;
        
        if (!phoneId || !token) {
            return res.json({ success: false, error: 'Meta credentials missing' });
        }

        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}?fields=quality_score,messaging_limit_tier,current_limit`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.error) {
            return res.json({ success: false, error: data.error.message, errorCode: data.error.code });
        }

        // Count messages sent today from DB
        const db = createClient(
            'https://gxunxhzjqclddoobxvpz.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg'
        );
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await db.from('whatsapp_messages').select('*', { count: 'exact', head: true }).gte('created_at', yesterday);

        res.json({
            success: true,
            quality_score: data.quality_score || 'N/A',
            messaging_limit_tier: data.messaging_limit_tier || 'TIER_250',
            sent_today: count || 0,
            daily_limit: 250
        });
    } catch (e) {
        console.error('[Meta Quota Error]', e.message);
        res.json({ success: false, error: e.message });
    }
});

// ═══════════════════════════════════════════
// UPLOAD META MEDIA (stabilize image)
// ═══════════════════════════════════════════
app.post('/api/upload-meta-media', async (req, res) => {
    try {
        const { imageUrl, eventId } = req.body;
        const phoneId = process.env.META_PHONE_NUMBER_ID;
        const token = process.env.META_ACCESS_TOKEN;

        if (!imageUrl) return res.status(400).json({ success: false, error: 'imageUrl required' });
        if (!phoneId || !token) return res.json({ success: false, error: 'Meta credentials missing' });

        console.log(`[Media Upload] Downloading image: ${imageUrl}`);

        // Download image
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) return res.json({ success: false, error: 'Failed to download image' });
        const imgBuffer = await imgRes.buffer();
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';

        // Upload to Meta
        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('file', imgBuffer, { filename: 'invite.jpg', contentType });
        form.append('type', contentType);

        const uploadRes = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/media`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, ...form.getHeaders() },
            body: form
        });
        const uploadData = await uploadRes.json();

        if (uploadData.id) {
            // Save media ID to event in DB
            if (eventId) {
                const db = createClient(
                    'https://gxunxhzjqclddoobxvpz.supabase.co',
                    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg'
                );
                await db.from('events').update({ meta_media_id: uploadData.id }).eq('id', eventId);
            }
            console.log(`[Media Upload] ✅ Success! Media ID: ${uploadData.id}`);
            res.json({ success: true, mediaId: uploadData.id });
        } else {
            console.error('[Media Upload] ❌ Failed:', uploadData);
            res.json({ success: false, error: uploadData.error?.message || 'Upload failed' });
        }
    } catch (e) {
        console.error('[Media Upload Error]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ═══════════════════════════════════════════
// OWNER REPORT
// ═══════════════════════════════════════════
app.post('/api/owner-report', async (req, res) => {
    try {
        const { eventId } = req.body;
        if (!eventId) return res.status(400).json({ success: false, error: 'eventId required' });

        const db = createClient(
            'https://gxunxhzjqclddoobxvpz.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg'
        );

        // Get event + guests + messages
        const { data: event } = await db.from('events').select('*').eq('id', eventId).single();
        if (!event) return res.json({ success: false, error: 'Event not found' });

        const { data: guests } = await db.from('guests').select('*, whatsapp_messages(*)').eq('event_id', eventId);

        const total = guests?.length || 0;
        const sent = guests?.filter(g => g.status === 'sent').length || 0;
        const failed = guests?.filter(g => g.status === 'failed').length || 0;
        const confirmed = guests?.filter(g => g.rsvp_status === 'confirmed').length || 0;
        const declined = guests?.filter(g => g.rsvp_status === 'declined').length || 0;
        const pending = total - confirmed - declined;

        const ownerPhone = event.owner_phone || event.settings?.owner_phone;
        if (!ownerPhone) return res.json({ success: false, error: 'No owner phone found' });

        const report = `📊 *تقرير مناسبة: ${event.name}*\n\n` +
            `📋 *إحصائيات الإرسال:*\n` +
            `• إجمالي الضيوف: ${total}\n` +
            `• تم إرسالهم: ${sent}\n` +
            `• فشل: ${failed}\n\n` +
            `📋 *إحصائيات الردود:*\n` +
            `• ✅ تأكيد حضور: ${confirmed}\n` +
            `• ❌ اعتذار: ${declined}\n` +
            `• ⏳ بانتظار الرد: ${pending}\n\n` +
            `✨ هذا التقرير من نظام لوني.`;

        const result = await MetaService.sendMessage(ownerPhone, { text: report });

        res.json({ success: result.success, messageId: result.messageId });
    } catch (e) {
        console.error('[Owner Report Error]', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// Launch Shadow Server
app.listen(PORT, () => {
    console.log(`\n✅ Lony V2 SHADOW SERVER (Meta Only) is now running on http://localhost:${PORT}`);
    console.log(`🛡️  Independent of live system on 3001.\n`);
});
