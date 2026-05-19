/**
 * MetaService.js - Test Version
 * Enhanced for granular delivery and read tracking.
 */
import fetch from 'node-fetch';

class MetaService {
    constructor() {
        this.baseUrl = 'https://graph.facebook.com/v18.0';
        this.defaultToken = process.env.META_ACCESS_TOKEN;
        this.defaultPhoneId = process.env.META_PHONE_NUMBER_ID;
    }

    async sendMessage(to, payload, credentials = {}) {
        const phoneId = credentials.phoneId || this.defaultPhoneId;
        const accessToken = credentials.token || this.defaultToken;

        if (!phoneId || !accessToken) {
            return { success: false, error: 'Meta credentials missing' };
        }

        const url = `${this.baseUrl}/${phoneId}/messages`;
        
        let body = {
            messaging_product: "whatsapp",
            to: this.normalizePhone(to),
        };

        if (payload.templateName) {
            body.type = "template";
            body.template = {
                name: payload.templateName,
                language: { code: payload.languageCode || 'ar' },
                components: this.buildTemplateComponents(payload)
            };
        } else if (payload.imageUrl) {
            body.type = "image";
            body.image = { link: payload.imageUrl, caption: payload.caption || '' };
        } else {
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
                const metaErr = data.error || {};
                return { 
                    success: false, 
                    error: metaErr.message || 'Meta API error',
                    errorCode: metaErr.code,
                    raw: data
                };
            }
        } catch (error) {
            return { success: false, error: `Network/Request Error: ${error.message}` };
        }
    }

    buildTemplateComponents(payload) {
        const components = [];
        if ((payload.imageUrl || payload.mediaId) && payload.templateName) {
            const headerParam = payload.mediaId 
                ? { type: "image", image: { id: payload.mediaId } }
                : { type: "image", image: { link: payload.imageUrl } };
            components.push({ type: "header", parameters: [headerParam] });
        }
        if (payload.variables) {
            const bodyParams = [];
            if (typeof payload.variables === 'object' && !Array.isArray(payload.variables)) {
                for (const [key, value] of Object.entries(payload.variables)) {
                    bodyParams.push({ type: "text", parameter_name: key, text: String(value) });
                }
            } else if (Array.isArray(payload.variables)) {
                payload.variables.forEach(v => {
                    bodyParams.push({ type: "text", text: String(v) });
                });
            }
            if (bodyParams.length > 0) {
                components.push({ type: "body", parameters: bodyParams });
            }
        }
        return components;
    }

    /**
     * Enhanced Parse Webhook
     * Now handles 'delivered' and 'read' statuses as well as messages.
     */
    parseWebhook(body) {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;

        // 1. Handle Status Updates (sent, delivered, read, failed)
        if (value?.statuses?.[0]) {
            const statusObj = value.statuses[0];
            return {
                type: 'status',
                status: statusObj.status, // sent, delivered, read, failed
                messageId: statusObj.id,
                phone: statusObj.recipient_id,
                timestamp: statusObj.timestamp,
                errors: statusObj.errors || null
            };
        }

        // 2. Handle Incoming Messages
        const msg = value?.messages?.[0];
        if (msg) {
            const phone = msg.from;
            let text = msg.text?.body || '';
            let buttonId = '';
            if (msg.type === 'interactive' && msg.interactive?.button_reply) {
                buttonId = msg.interactive.button_reply.id;
                text = msg.interactive.button_reply.title;
            }
            return { type: 'message', phone, text, buttonId, raw: msg };
        }

        return null;
    }

    normalizePhone(phone) {
        if (!phone) return '';
        let clean = phone.toString().replace(/\D/g, '');
        if (clean.startsWith('05') && clean.length === 10) clean = '966' + clean.substring(1);
        else if (clean.startsWith('5') && clean.length === 9) clean = '966' + clean;
        else if (clean.length === 9 && !clean.startsWith('966')) clean = '966' + clean;
        return clean;
    }
}

export default new MetaService();
