import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const payload = {
        guest_id: "d58eac57-066c-42d2-8a57-6e39709c0659",
        event_id: "a5931bed-8ae0-4881-9a6d-f55964859426",
        status: "failed",
        error_message: "Test Insert Failure Error"
    };

    console.log("🚀 Testing manual insert into whatsapp_messages...");
    const { data, error } = await supabase
        .from('whatsapp_messages')
        .insert(payload)
        .select();

    if (error) {
        console.error("❌ Insert failed:", error);
    } else {
        console.log("✅ Insert succeeded:", data);
        
        // Clean it up
        if (data && data[0]?.id) {
            await supabase.from('whatsapp_messages').delete().eq('id', data[0].id);
            console.log("🧹 Cleaned up test record.");
        }
    }
}

run();
