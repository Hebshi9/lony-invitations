import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function searchErrors() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`Searching for errors in webhook_debug_logs since ${yesterday}...`);

    const { data: logs, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .gte('created_at', yesterday)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    console.log(`Total debug logs fetched: ${logs.length}`);
    
    // Filter logs for errors
    const errorLogs = logs.filter(l => {
        const payloadStr = JSON.stringify(l.payload).toLowerCase();
        return payloadStr.includes('error') || payloadStr.includes('fail') || payloadStr.includes('reject');
    });

    console.log(`Found ${errorLogs.length} logs with potential errors:`);
    errorLogs.slice(0, 10).forEach((l, idx) => {
        console.log(`[${idx+1}] Log ID: ${l.id} | Created At: ${l.created_at}`);
        console.log(`    Payload Snippet:`, JSON.stringify(l.payload, null, 2).slice(0, 800));
        console.log("------------------------------------------------------------------");
    });
}

searchErrors();
