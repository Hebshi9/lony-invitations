
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

/**
 * Generic Send Function for Netlify
 * Handles direct WhatsApp messages via Meta Cloud API
 * Payload: { phone: string, message: string }
 */
export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { phone, message, template, params } = JSON.parse(event.body);

        if (!phone || (!message && !template)) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Phone and (message or template) are required' }) };
        }

        // Format Phone (Saudi Arabia defaults)
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('05')) {
            cleanPhone = '966' + cleanPhone.substring(1);
        } else if (cleanPhone.startsWith('5') && cleanPhone.length === 9) {
            cleanPhone = '966' + cleanPhone;
        }

        console.log(`[Send] Sending ${template ? 'template ' + template : 'text'} to ${cleanPhone}...`);

        // Prepare Payload
        let payload;
        if (template) {
            payload = {
                messaging_product: 'whatsapp',
                to: cleanPhone,
                type: 'template',
                template: {
                    name: template,
                    language: { code: 'ar' },
                    components: [
                        {
                            type: 'body',
                            parameters: (params || []).map(p => ({ type: 'text', text: p }))
                        }
                    ]
                }
            };
        } else {
            payload = {
                messaging_product: 'whatsapp',
                to: cleanPhone,
                type: 'text',
                text: { body: message }
            };
        }

        const response = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (data.messages) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, messageId: data.messages[0].id })
            };
        } else {
            console.error('[Meta API Error]', data.error);
            return {
                statusCode: 200, // Return 200 but with success: false to let frontend handle it gracefully
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: false, error: data.error?.message || 'Failed to send message' })
            };
        }

    } catch (error) {
        console.error('[Server Error]', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
