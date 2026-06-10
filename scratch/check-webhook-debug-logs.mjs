import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    console.log('🔍 Fetching latest logs from webhook_debug_logs...');
    const { data, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }
    
    if (data && data.length > 0) {
        data.forEach((log, index) => {
            console.log(`\n--- Log #${index + 1} | ID: ${log.id} | Created: ${log.created_at} ---`);
            console.log(JSON.stringify(log.payload, null, 2));
        });
    } else {
        console.log('No webhook debug logs found.');
    }
}

checkLogs();
