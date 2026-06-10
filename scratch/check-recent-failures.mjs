import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    console.log(`🔍 Checking messages and logs since ${twoHoursAgo} ...`);

    // 1. Fetch recent messages
    const { data: messages, error: msgError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .gt('created_at', twoHoursAgo)
        .order('created_at', { ascending: false });

    if (msgError) {
        console.error('Error fetching messages:', msgError);
    } else {
        console.log(`\n💬 Recent messages found: ${messages.length}`);
        messages.forEach(m => {
            console.log(`- ID: ${m.id} | Phone: ${m.phone} | Status: ${m.status} | Phase: ${m.message_phase} | Error: ${m.error_message} | Created: ${m.created_at}`);
        });
    }

    // 2. Fetch recent webhook logs
    const { data: logs, error: logError } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .gt('created_at', twoHoursAgo)
        .order('created_at', { ascending: false })
        .limit(10);

    if (logError) {
        console.error('Error fetching webhook logs:', logError);
    } else {
        console.log(`\n📋 Recent Webhook/Debug Logs found: ${logs.length}`);
        logs.forEach(l => {
            console.log(`- ID: ${l.id} | Event: ${l.event_type || 'N/A'} | Error: ${JSON.stringify(l.error || l.payload?.error || '')} | Created: ${l.created_at}`);
            if (l.payload) {
                console.log(`  Payload: ${JSON.stringify(l.payload).substring(0, 300)}`);
            }
        });
    }
}

run();
