import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const GUEST_ID = '5315b960-40a3-46e2-896c-58569abdb17d';

async function run() {
    console.log(`🔍 Querying messages for Huda (${GUEST_ID})...`);
    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('guest_id', GUEST_ID)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} messages:`);
    data.forEach(m => {
        console.log(`- Time: ${m.created_at} | Status: ${m.status} | Error: ${m.error_message}`);
    });
}

run();
