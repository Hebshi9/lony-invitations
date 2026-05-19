// WhatsApp Service - Multi-Account Management
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

class WhatsAppService {
    constructor() {
        this.clients = new Map(); // accountId -> client instance
        this.qrCallbacks = new Map(); // accountId -> callback function
    }

    /**
     * Initialize a WhatsApp client for a specific account
     */
    async initializeClient(accountId, phoneNumber) {
        if (this.clients.has(accountId)) {
            console.log(`Client already exists for account ${accountId}`);
            return this.clients.get(accountId);
        }

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: accountId
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        // QR Code event
        client.on('qr', (qr) => {
            console.log(`🔥 QR Code RECEIVED for account ${accountId}`);
            console.log(`   -> QR length: ${qr.length}`);

            // Generate terminal QR for debugging
            try { qrcode.generate(qr, { small: true }); } catch (e) { console.error('Terminal QR error:', e); }

            // Call callback if registered
            const callback = this.qrCallbacks.get(accountId);
            if (callback) {
                console.log(`   -> Sending QR to frontend via SSE callback`);
                callback(qr);
            } else {
                console.warn(`   -> NO CALLBACK registered for account ${accountId}! Frontend won't see this.`);
            }
        });

        // Ready event
        client.on('ready', async () => {
            console.log(`WhatsApp client ready for account ${accountId}`);

            // Update account status in database
            await supabase
                .from('whatsapp_accounts')
                .update({
                    status: 'connected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', accountId);
        });

        // Disconnected event
        client.on('disconnected', async (reason) => {
            console.log(`Client disconnected for account ${accountId}:`, reason);

            // Update account status
            await supabase
                .from('whatsapp_accounts')
                .update({
                    status: 'disconnected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', accountId);

            this.clients.delete(accountId);
        });

        // Authentication failure
        client.on('auth_failure', async (msg) => {
            console.error(`Auth failure for account ${accountId}:`, msg);

            await supabase
                .from('whatsapp_accounts')
                .update({
                    status: 'disconnected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', accountId);
        });

        // Incoming message handler for RSVP
        client.on('message', async (msg) => {
            try {
                await this.handleIncomingMessage(accountId, msg);
            } catch (error) {
                console.error(`Error handling incoming message:`, error);
            }
        });

        this.clients.set(accountId, client);
        await client.initialize();

        return client;
    }

    /**
     * Handle incoming WhatsApp messages for RSVP detection
     */
    async handleIncomingMessage(accountId, msg) {
        const from = msg.from.replace('@c.us', ''); // Remove WhatsApp suffix
        const messageText = msg.body.toLowerCase().trim();

        // Find guest by phone number
        const { data: guests } = await supabase
            .from('guests')
            .select('id, event_id, name, card_image_url')
            .ilike('phone', `%${from}%`)
            .limit(1);

        if (!guests || guests.length === 0) {
            console.log(`No guest found for phone: ${from}`);
            return;
        }

        const guest = guests[0];

        // Detect response using keywords
        const response = this.detectRSVPResponse(messageText);

        if (!response) {
            console.log(`Could not detect RSVP response from: "${messageText}"`);
            return;
        }

        // Save RSVP to database
        const { data: rsvp, error: rsvpError } = await supabase
            .from('whatsapp_rsvp')
            .insert({
                guest_id: guest.id,
                event_id: guest.event_id,
                response: response,
                response_message: msg.body
            })
            .select()
            .single();

        if (rsvpError) {
            console.error('Error saving RSVP:', rsvpError);
            return;
        }

        console.log(`✓ RSVP recorded: ${guest.name} - ${response}`);

        // Send confirmation message
        let replyMessage = '';
        if (response === 'confirmed') {
            replyMessage = `شكراً لتأكيد حضورك يا ${guest.name}! 🎉\n\nسنرسل لك كرت الدعوة خلال لحظات...`;

            // Send card image if available
            if (guest.card_image_url) {
                setTimeout(async () => {
                    try {
                        await this.sendMessage(
                            accountId,
                            from,
                            'هذا كرت دعوتك الخاص 💐\nاحتفظ به وأحضره معك يوم المناسبة.',
                            guest.card_image_url
                        );

                        // Mark card as sent
                        await supabase
                            .from('whatsapp_rsvp')
                            .update({
                                card_sent: true,
                                card_sent_at: new Date().toISOString()
                            })
                            .eq('id', rsvp.id);

                        console.log(`✓ Card sent to ${guest.name}`);
                    } catch (error) {
                        console.error(`Error sending card to ${guest.name}:`, error);
                    }
                }, 2000); // Wait 2 seconds before sending card
            }
        } else if (response === 'declined') {
            replyMessage = `نأسف لعدم تمكنك من الحضور يا ${guest.name} 😔\nنتمنى لك كل التوفيق!`;
        } else if (response === 'maybe') {
            replyMessage = `شكراً على ردك يا ${guest.name}!\nنأمل أن تتمكن من الحضور 🙏`;
        }

        // Send reply
        if (replyMessage) {
            const formattedNumber = from + '@c.us';
            const client = this.clients.get(accountId);
            if (client) {
                await client.sendMessage(formattedNumber, replyMessage);
            }
        }
    }

    /**
     * Detect RSVP response from message text
     */
    detectRSVPResponse(messageText) {
        const confirmedKeywords = ['نعم', 'أكيد', 'موافق', 'حاضر', 'yes', 'confirm', 'ok', 'تمام', 'ان شاء الله'];
        const declinedKeywords = ['لا', 'اعتذر', 'ما أقدر', 'no', 'decline', 'sorry', 'مشغول', 'ما اقدر'];
        const maybeKeywords = ['ممكن', 'غير متأكد', 'maybe', 'not sure', 'مو متأكد'];

        // Check for confirmed
        if (confirmedKeywords.some(keyword => messageText.includes(keyword))) {
            return 'confirmed';
        }

        // Check for declined
        if (declinedKeywords.some(keyword => messageText.includes(keyword))) {
            return 'declined';
        }

        // Check for maybe
        if (maybeKeywords.some(keyword => messageText.includes(keyword))) {
            return 'maybe';
        }

        return null;
    }

    /**
     * Register QR code callback
     */
    onQRCode(accountId, callback) {
        this.qrCallbacks.set(accountId, callback);
    }

    /**
     * Send a message with optional media
     */
    async sendMessage(accountId, phoneNumber, message, mediaUrl = null) {
        const client = this.clients.get(accountId);

        if (!client) {
            throw new Error(`No client found for account ${accountId}`);
        }

        // Format phone number (remove + and spaces)
        const formattedNumber = phoneNumber.replace(/[^0-9]/g, '') + '@c.us';

        try {
            if (mediaUrl) {
                // Send with media
                const media = await this.downloadMedia(mediaUrl);
                await client.sendMessage(formattedNumber, media, {
                    caption: message
                });
            } else {
                // Send text only
                await client.sendMessage(formattedNumber, message);
            }

            return { success: true };
        } catch (error) {
            console.error(`Error sending message from account ${accountId}:`, error);

            // Check if account might be banned
            if (error.message.includes('banned') || error.message.includes('blocked')) {
                await supabase
                    .from('whatsapp_accounts')
                    .update({ status: 'banned' })
                    .eq('id', accountId);
            }

            throw error;
        }
    }

    /**
     * Download media from URL
     */
    async downloadMedia(url) {
        const { MessageMedia } = await import('whatsapp-web.js');

        // Fetch the image
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        // Determine mimetype
        const mimetype = response.headers.get('content-type') || 'image/jpeg';

        return new MessageMedia(mimetype, base64);
    }

    /**
     * Disconnect a specific account
     */
    async disconnect(accountId) {
        const client = this.clients.get(accountId);

        if (client) {
            try {
                await client.logout(); // Change destroy via logout to ensure file cleanup
                await client.destroy();
            } catch (error) {
                console.error(`Error disconnecting client ${accountId}:`, error);
            }
        }

        // Always cleanup maps even if destroy fails
        this.clients.delete(accountId);
        this.qrCallbacks.delete(accountId);

        // Update DB status just in case
        try {
            await supabase
                .from('whatsapp_accounts')
                .update({ status: 'disconnected' })
                .eq('id', accountId);
        } catch (e) { console.error('Error updating DB status:', e); }
    }

    /**
     * Disconnect all accounts
     */
    async disconnectAll() {
        for (const [accountId, client] of this.clients.entries()) {
            await client.destroy();
        }

        this.clients.clear();
        this.qrCallbacks.clear();
    }

    /**
     * Get client status
     */
    getClientStatus(accountId) {
        const client = this.clients.get(accountId);
        return client ? 'connected' : 'disconnected';
    }

    /**
     * Check if account is ready
     */
    isReady(accountId) {
        const client = this.clients.get(accountId);
        return client && client.info;
    }
}

// Singleton instance
const whatsappService = new WhatsAppService();

export default whatsappService;
