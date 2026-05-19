import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkVeryRecentLogs() {
    console.log('Checking for any webhook activity in the last 10 minutes...');
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase.from('webhook_debug_logs')
        .select('*')
        .gte('created_at', tenMinsAgo)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log(`\n✅ Found ${data.length} recent webhook calls:`);
        data.forEach(log => {
            console.log(`- Time: ${log.created_at}`);
            // Check if it's a message or status
            const entry = log.payload?.entry?.[0];
            const change = entry?.changes?.[0]?.value;
            if (change?.messages) console.log(`  TYPE: MESSAGE from ${change.messages[0].from}`);
            else if (change?.statuses) console.log(`  TYPE: STATUS ${change.statuses[0].status}`);
            else console.log(`  TYPE: UNKNOWN`);
        });
    } else {
        console.log('❌ NO WEBHOOK CALLS RECEIVED from Meta in the last 10 minutes.');
    }
}

checkVeryRecentLogs();
