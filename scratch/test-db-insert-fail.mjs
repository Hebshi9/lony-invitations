import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("🚀 Testing database insert for a failed log...");
    const testLog = {
        guest_id: '5315b960-40a3-46e2-896c-58569abdb17d', // Huda
        event_id: 'a5931bed-8ae0-4881-9a6d-f55964859426', // Nader & Awatef
        phone: '966503678789',
        status: 'failed',
        error_message: 'Test Authentication Error logs'
    };

    const { data, error } = await supabase
        .from('whatsapp_messages')
        .insert(testLog)
        .select();

    if (error) {
        console.error("❌ DB Insert Failed:", error);
    } else {
        console.log("✅ DB Insert Succeeded:", data);
        // Let's delete it so we don't pollute the logs
        await supabase.from('whatsapp_messages').delete().eq('id', data[0].id);
        console.log("🗑️ Test record cleaned up.");
    }
}

run();
