const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gxunxhzjqclddoobxvpz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0');

async function checkLogs() {
    const { data: logs, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    logs.forEach((log, i) => {
        console.log(`--- Log #${i+1} (${log.created_at}) ---`);
        console.log(JSON.stringify(log.payload, null, 2));
    });
}
checkLogs();
