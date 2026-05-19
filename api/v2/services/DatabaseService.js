/**
 * Database Service - V2
 * Centralized Supabase operations.
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';

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

    async updateMessageDeliveryStatus(metaMessageId, status, errorData = null) {
        console.log(`[DatabaseService] Updating status for ${metaMessageId} -> ${status}`);
        
        const updateObj = {
            delivery_status: status,
            updated_at: new Date().toISOString()
        };

        if (status === 'delivered') updateObj.delivered_at = new Date().toISOString();
        if (status === 'read') updateObj.read_at = new Date().toISOString();
        
        if (errorData) {
            updateObj.error_message = errorData.message || errorData.title || JSON.stringify(errorData);
            updateObj.status = 'failed';
        }

        // 1. Update the message record
        const { data: msg, error: msgErr } = await this.client
            .from('whatsapp_messages')
            .update(updateObj)
            .eq('evolution_message_id', metaMessageId) 
            .select('guest_id')
            .maybeSingle();

        if (msgErr) console.error('[DatabaseService] ❌ Status Update Error:', msgErr.message);

        // 2. If failed, update the guest status too
        if (status === 'failed' && msg?.guest_id) {
            console.log(`[DatabaseService] 🚩 Marking guest ${msg.guest_id} as failed due to Meta rejection.`);
            await this.client
                .from('guests')
                .update({ 
                    status: 'failed', 
                    updated_at: new Date().toISOString() 
                })
                .eq('id', msg.guest_id);
        }

        return { success: !msgErr };
    }
}

export default new DatabaseService();
