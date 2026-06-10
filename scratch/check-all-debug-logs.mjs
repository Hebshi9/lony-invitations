import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("🔍 Fetching recent entries from webhook_debug_logs...");
    const { data: logs, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log(`📊 Found ${logs.length} debug logs:`);
    logs.forEach((l, idx) => {
        console.log(`\n[${idx+1}] Created At: ${l.created_at} | Event: ${l.event_type || 'N/A'}`);
        console.log(`Payload: ${JSON.stringify(l.payload || l.error || '')}`);
    });
}

run();
