/**
 * Database Service - V2
 * Centralized Supabase operations.
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

class DatabaseService {
    constructor() {
        this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    async getAccounts() {
        const { data, error } = await this.client
            .from('whatsapp_accounts')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    }

    async updateAccountStatus(id, status) {
        return await this.client
            .from('whatsapp_accounts')
            .update({ status, last_seen: new Date().toISOString() })
            .eq('id', id);
    }

    async findGuestByPhone(phone) {
        // Robust phone normalization for Saudi numbers
        let clean = phone.replace(/\D/g, '');
        const variants = [clean];
        
        if (clean.startsWith('966')) {
            variants.push('0' + clean.substring(3));
            variants.push(clean.substring(3));
        } else if (clean.startsWith('05')) {
            variants.push('966' + clean.substring(1));
            variants.push(clean.substring(1));
        } else if (clean.length === 9 && clean.startsWith('5')) {
            variants.push('0' + clean);
            variants.push('966' + clean);
        }

        const { data, error } = await this.client
            .from('guests')
            .select('*, events(id, name, groom_name, bride_name)')
            .in('phone', variants)
            .limit(1)
            .maybeSingle();
            
        return { data, error };
    }

    async updateRSVPStatus(guestId, status) {
        return await this.client
            .from('guests')
            .update({ 
                rsvp_status: status, 
                rsvp_at: new Date().toISOString() 
            })
            .eq('id', guestId);
    }

    async logSentMessage({ eventId, guestId, phone, text, imageUrl, metaMessageId }) {
        return await this.client.from('whatsapp_messages').insert({
            event_id: eventId,
            guest_id: guestId,
            phone: phone,
            message_text: text,
            image_url: imageUrl,
            status: 'sent',
            sent_at: new Date().toISOString(),
            evolution_message_id: metaMessageId // Reusing column for consistency or we can add meta_message_id
        });
    }

    async logReply({ guestId, eventId, phone, text, rsvpStatus, confidence }) {
        return await this.client.from('whatsapp_replies').insert({
            guest_id: guestId,
            event_id: eventId,
            phone: phone,
            reply_text: text,
            is_rsvp: !!rsvpStatus,
            rsvp_response: rsvpStatus,
            ai_confidence: confidence || 0
        });
    }
}

export default new DatabaseService();
