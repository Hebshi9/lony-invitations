import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const EVENT_ID = 'a5931bed-8ae0-4881-9a6d-f55964859426'; // Nader & Awatef

async function run() {
    console.log(`🔍 Fetching 10 latest messages for Event ID: ${EVENT_ID}...`);
    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('id, guest_id, status, error_message, phone, created_at')
        .eq('event_id', EVENT_ID)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("❌ Error fetching messages:", error);
        return;
    }

    console.log(`📊 Found ${messages.length} messages:`);
    messages.forEach(m => {
        console.log(`- Time: ${m.created_at} | Phone: ${m.phone} | Status: ${m.status} | Error: ${m.error_message || 'None'}`);
    });
}

run();
