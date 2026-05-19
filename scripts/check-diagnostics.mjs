import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkDiagnostics() {
    console.log('🔍 Checking webhook_debug_logs for diagnostic errors...');
    const { data, error } = await supabase.from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    if (data && data.length > 0) {
        data.forEach(log => {
            console.log(`[${log.created_at}] Payload:`, JSON.stringify(log.payload, null, 2));
        });
    } else {
        console.log('No recent logs found.');
    }
}

checkDiagnostics();
