/**
 * MetaService.js - Modular Service for Meta Cloud API (Official)
 * Handles sending text, images, and templates via WhatsApp.
 */
import fetch from 'node-fetch';

class MetaService {
    constructor() {
        this.baseUrl = 'https://graph.facebook.com/v18.0';
        this.defaultToken = process.env.META_ACCESS_TOKEN;
        this.defaultPhoneId = process.env.META_PHONE_NUMBER_ID;
    }

    /**
     * Unified Send Function
     * @param {string} to - Recipient phone number
     * @param {Object} payload - Message details
     * @param {Object} credentials - Optional specific Meta credentials
     */
    async sendMessage(to, payload, credentials = {}) {
        const phoneId = credentials.phoneId || this.defaultPhoneId;
        const accessToken = credentials.token || this.defaultToken;

        if (!phoneId || !accessToken) {
            console.error('[MetaService] ❌ Missing credentials');
            return { success: false, error: 'Meta credentials missing' };
        }

        const url = `${this.baseUrl}/${phoneId}/messages`;
        
        let body = {
            messaging_product: "whatsapp",
            to: this.normalizePhone(to),
        };

        // 1. Template Message
        if (payload.templateName) {
            body.type = "template";
            body.template = {
                name: payload.templateName,
                language: { code: payload.languageCode || 'ar' },
                components: this.buildTemplateComponents(payload)
            };
        } 
        // 2. Image Message
        else if (payload.imageUrl) {
            body.type = "image";
            body.image = { 
                link: payload.imageUrl, 
                caption: payload.caption || '' 
            };
        } 
        // 3. Text Message
        else {
            body.type = "text";
            body.text = { body: payload.text || '' };
        }

        try {
            console.log(`📡 [MetaService] Sending ${body.type.toUpperCase()} to ${url}:`);
            if (body.type === 'template') {
                console.log(`💎 [GOLDEN TEMPLATE] Name: ${body.template.name}`);
            }
            console.log(JSON.stringify(body, null, 2));

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            
            if (!response.ok) {
                console.error(`❌ [MetaService] API Error:`, JSON.stringify(data, null, 2));
            } else {
                console.log(`✅ [MetaService] API Success:`, JSON.stringify(data, null, 2));
            }

            if (data.messages && data.messages.length > 0) {
                return { 
                    success: true, 
                    messageId: data.messages[0].id,
                    provider: 'meta'
                };
            } else {
                const metaErr = data.error || {};
                console.error('[MetaService] ❌ Meta API Error:', JSON.stringify(data));
                return { 
                    success: false, 
                    error: metaErr.message || 'Meta API error',
                    errorCode: metaErr.code,
                    errorSubcode: metaErr.error_subcode,
                    fbtraceId: metaErr.fbtrace_id,
                    raw: data
                };
            }
        } catch (error) {
            console.error('[MetaService] 💥 Request Exception:', error.message);
            return { success: false, error: `Network/Request Error: ${error.message}` };
        }
    }

    /**
     * Build Meta Template Components (Headers & Body Variables)
     */
    buildTemplateComponents(payload) {
        const components = [];

        // Header Component (Image or Media ID)
        if ((payload.imageUrl || payload.mediaId) && payload.templateName) {
            const headerParam = payload.mediaId 
                ? { type: "image", image: { id: payload.mediaId } }
                : { type: "image", image: { link: payload.imageUrl } };

            components.push({
                type: "header",
                parameters: [headerParam]
            });
        }

        // Body Component (Variables)
        if (payload.variables) {
            const bodyParams = [];
            
            // Handle Named Parameters (preferred)
            if (typeof payload.variables === 'object' && !Array.isArray(payload.variables)) {
                for (const [key, value] of Object.entries(payload.variables)) {
                    bodyParams.push({ 
                        type: "text", 
                        parameter_name: key,
                        text: String(value) 
                    });
                }
            } 
            // Handle Positional Parameters (fallback)
            else if (Array.isArray(payload.variables)) {
                payload.variables.forEach(v => {
                    bodyParams.push({ type: "text", text: String(v) });
                });
            }

            if (bodyParams.length > 0) {
                components.push({
                    type: "body",
                    parameters: bodyParams
                });
            }
        }

        return components;
    }

    /**
     * Parse official Meta Cloud API Webhook payload
     */
    parseWebhook(body) {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // 1. Handle Incoming Messages (Chat/RSVP)
        if (value?.messages?.[0]) {
            const msg = value.messages[0];
            const phone = msg.from;
            let text = msg.text?.body || '';
            let buttonId = '';

            if (msg.type === 'interactive' && msg.interactive?.button_reply) {
                buttonId = msg.interactive.button_reply.id;
                text = msg.interactive.button_reply.title;
            }

            return { 
                type: 'message',
                phone, 
                text, 
                buttonId, 
                raw: msg 
            };
        }

        // 2. Handle Status Updates (sent, delivered, read, failed)
        if (value?.statuses?.[0]) {
            const statusObj = value.statuses[0];
            return {
                type: 'statusUpdate',
                metaMessageId: statusObj.id,
                status: statusObj.status,
                recipientId: statusObj.recipient_id,
                errors: statusObj.errors || null,
                timestamp: statusObj.timestamp,
                raw: statusObj
            };
        }

        return null;
    }
}
    /**
     * Clean and format phone number for Meta
     */
    normalizePhone(phone) {
        if (!phone) return '';
        let clean = phone.toString().replace(/\D/g, '');
        
        // Saudi Arabia (966) normalization
        if (clean.startsWith('05') && clean.length === 10) {
            clean = '966' + clean.substring(1);
        } else if (clean.startsWith('5') && clean.length === 9) {
            clean = '966' + clean;
        } else if (clean.length === 9 && !clean.startsWith('966')) {
            clean = '966' + clean;
        }
        
        return clean;
    }
}

export default new MetaService();
