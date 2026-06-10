import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkFailed() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`Checking failed messages since ${yesterday}...`);

    const { data: failed, error } = await supabase
        .from('whatsapp_messages')
        .select('*, guests(name, phone), events(name)')
        .eq('status', 'failed')
        .gte('created_at', yesterday);

    if (error) {
        console.error("Error fetching failed:", error);
        return;
    }

    console.log(`\nFound ${failed.length} failed messages in the last 24 hours:`);
    failed.forEach((m, idx) => {
        console.log(`- Guest: ${m.guests?.name} (${m.guests?.phone})`);
        console.log(`  Event: ${m.events?.name}`);
        console.log(`  Phase: ${m.message_phase}`);
        console.log(`  Error: ${m.error_message}`);
        console.log(`  Created At: ${m.created_at}`);
        console.log("----------------------------------------");
    });
}

checkFailed();
