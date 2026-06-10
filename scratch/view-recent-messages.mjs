import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
const PHONES = ['966503678789', '966507240097'];

async function checkRecentMessages() {
    console.log('🔍 Fetching latest WhatsApp messages for test guests...');
    
    for (const phone of PHONES) {
        const { data: guests, error: guestErr } = await supabase
            .from('guests')
            .select('*')
            .eq('event_id', EVENT_ID)
            .ilike('phone', `%${phone.slice(-9)}`);
            
        if (guestErr || !guests || guests.length === 0) {
            console.log(`Guest with phone ${phone} not found.`);
            continue;
        }
        
        const guest = guests[0];
        console.log(`\n👤 Guest: ${guest.name} (${guest.phone}) | Status: ${guest.status}`);
        
        const { data: messages, error: msgErr } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('guest_id', guest.id)
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (msgErr) {
            console.error('Error fetching messages:', msgErr);
            continue;
        }
        
        if (messages && messages.length > 0) {
            messages.forEach(m => {
                console.log(`  - Msg ID: ${m.id} | Status: ${m.status} | Created: ${m.created_at} | Payload Preview: ${JSON.stringify(m.payload?.template?.name || m.payload)}`);
            });
        } else {
            console.log('  No messages found.');
        }
    }
}

checkRecentMessages();
