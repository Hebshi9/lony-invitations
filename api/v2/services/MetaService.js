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
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (data.messages && data.messages.length > 0) {
                return { 
                    success: true, 
                    messageId: data.messages[0].id,
                    provider: 'meta'
                };
            } else {
                console.error('[MetaService] ❌ Meta API Error:', JSON.stringify(data));
                return { 
                    success: false, 
                    error: data.error?.message || 'Meta API error',
                    raw: data
                };
            }
        } catch (error) {
            console.error('[MetaService] 💥 Request Exception:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Build Meta Template Components (Headers & Body Variables)
     */
    buildTemplateComponents(payload) {
        const components = [];

        // Header Component (Image)
        if (payload.imageUrl && payload.templateName) {
            components.push({
                type: "header",
                parameters: [{ type: "image", image: { link: payload.imageUrl } }]
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
        const msg = value?.messages?.[0];

        if (!msg) return null;

        const phone = msg.from;
        let text = msg.text?.body || '';
        let buttonId = '';

        // Handle Interactive Button Replies
        if (msg.type === 'interactive' && msg.interactive?.button_reply) {
            buttonId = msg.interactive.button_reply.id;
            text = msg.interactive.button_reply.title;
        }

        return { phone, text, buttonId, raw: msg };
    }

    /**
     * Clean and format phone number for Meta
     */
    normalizePhone(phone) {
        if (!phone) return '';
        let clean = phone.toString().replace(/\D/g, '');
        // Meta expects format WITHOUT '+' but with country code (e.g. 966...)
        // If it starts with 05, replace with 9665
        if (clean.startsWith('05') && clean.length === 10) {
            clean = '966' + clean.substring(1);
        }
        return clean;
    }
}

export default new MetaService();
