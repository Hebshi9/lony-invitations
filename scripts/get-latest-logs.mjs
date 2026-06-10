import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function getLatestLogs() {
    console.log("Fetching latest WhatsApp messages...");

    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*, guests(name, phone), events(name)')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching latest messages:", error);
        return;
    }

    console.log("\n=============================================");
    console.log("📝 10 LATEST MESSAGES LOGGED");
    console.log("=============================================");
    messages.forEach((m, idx) => {
        console.log(`[${idx+1}] Guest: ${m.guests?.name} (${m.guests?.phone})`);
        console.log(`    Event: ${m.events?.name} (${m.event_id})`);
        console.log(`    Phase: ${m.message_phase}`);
        console.log(`    Status: ${m.status} | Delivery Status: ${m.delivery_status}`);
        console.log(`    Error: ${m.error_message}`);
        console.log(`    Created At: ${m.created_at}`);
        console.log("---------------------------------------------");
    });
}

getLatestLogs();
