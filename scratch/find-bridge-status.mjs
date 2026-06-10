import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findBridgeLogs() {
    console.log('🔍 Fetching bridge action logs...');
    const { data, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
        
    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }
    
    let count = 0;
    data.forEach((log) => {
        const payload = log.payload;
        if (payload && (payload.bridge_action || JSON.stringify(payload).includes('re_send_attempt_v2'))) {
            count++;
            console.log(`\n--- Bridge Log #${count} | Created: ${log.created_at} ---`);
            console.log(JSON.stringify(payload, null, 2));
        }
    });
    
    if (count === 0) {
        console.log('No bridge re-send logs found in the loaded 20 items.');
    }
}

findBridgeLogs();
