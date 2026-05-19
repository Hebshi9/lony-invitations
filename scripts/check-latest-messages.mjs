import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMessages() {
    console.log('🔍 Fetching latest WhatsApp messages...');
    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select(`
            id,
            guest_id,
            status,
            error_message,
            created_at,
            evolution_message_id,
            guests (name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Error fetching messages:', error);
        return;
    }

    console.log('✅ Latest messages:');
    console.log(JSON.stringify(data, null, 2));
}

checkMessages();
