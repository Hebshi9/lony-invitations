import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkDebugLogs() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    console.log(`Checking debug logs since ${oneHourAgo}...`);

    const { data: logs, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    console.log(`\nFound ${logs.length} debug logs in the last hour:`);
    logs.forEach((l, idx) => {
        console.log(`[${idx+1}] Log ID: ${l.id}`);
        console.log(`    Payload:`, JSON.stringify(l.payload, null, 2));
        console.log(`    Created At: ${l.created_at}`);
        console.log("---------------------------------------------");
    });
}

checkDebugLogs();
