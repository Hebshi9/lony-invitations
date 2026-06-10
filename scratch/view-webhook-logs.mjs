import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getLogs() {
    const { data, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
        
    if (error) {
        console.error(error);
        return;
    }
    
    data.forEach((log, index) => {
        console.log(`\n--- Log #${index + 1} (${log.created_at}) ---`);
        console.log(JSON.stringify(log.payload, null, 2));
    });
}

getLogs();
