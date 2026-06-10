import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("🔍 Fetching messages sent today (2026-06-09) from database...");
    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select(`
            id,
            guest_id,
            event_id,
            phone,
            status,
            delivery_status,
            error_message,
            created_at,
            message_text,
            guests (name)
        `)
        .gte('created_at', '2026-06-09T00:00:00.000Z')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching messages:', error);
        return;
    }

    console.log(`📊 Found ${messages.length} messages sent today:`);
    messages.forEach((m, idx) => {
        console.log(`[${idx+1}] Created: ${m.created_at} | Guest: ${m.guests?.name} (${m.phone}) | Status: ${m.status}/${m.delivery_status} | Error: ${m.error_message || 'None'}`);
    });
}

run();
