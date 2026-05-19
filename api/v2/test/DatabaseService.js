/**
 * DatabaseService.js - Test Version
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

class DatabaseService {
    constructor() {
        this.client = supabase;
    }

    async findGuestByPhone(phone) {
        // Handle Saudi normalization in search
        const cleanPhone = phone.replace(/\D/g, '').slice(-9);
        return await this.client
            .from('guests')
            .select('*, events(*)')
            .ilike('phone', `%${cleanPhone}`)
            .maybeSingle();
    }

    async updateDeliveryStatus(messageId, status, error = null) {
        console.log(`[DB Test] Updating status for ${messageId} -> ${status}`);
        return await this.client
            .from('whatsapp_messages')
            .update({ 
                delivery_status: status,
                error_message: error ? JSON.stringify(error) : null,
                updated_at: new Date().toISOString()
            })
            .eq('evolution_message_id', messageId);
    }

    async updateRSVPStatus(guestId, status) {
        return await this.client
            .from('guests')
            .update({ 
                whatsapp_rsvp_status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', guestId);
    }

    async logSentMessage(data) {
        return await this.client
            .from('whatsapp_messages')
            .insert({
                phone: data.phone,
                message_text: data.text,
                image_url: data.imageUrl,
                evolution_message_id: data.metaMessageId,
                status: 'sent',
                delivery_status: 'sent',
                created_at: new Date().toISOString()
            });
    }

    async logReply(data) {
        return await this.client
            .from('whatsapp_replies')
            .insert({
                guest_id: data.guestId,
                event_id: data.eventId,
                phone: data.phone,
                message_text: data.text,
                reply_type: data.rsvpStatus ? 'rsvp' : 'text',
                ai_confidence: data.confidence || 1.0,
                created_at: new Date().toISOString()
            });
    }
}

export default new DatabaseService();
