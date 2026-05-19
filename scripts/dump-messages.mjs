import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const realSupabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function dumpRecentMessages() {
    console.log('🔍 Dumping last 10 messages from whatsapp_messages...');
    const { data, error } = await realSupabase.from('whatsapp_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    data.forEach(m => {
        console.log(`Time: ${m.created_at} | Phase: ${m.message_phase} | GuestID: ${m.guest_id}`);
        console.log(`WAMID: ${m.evolution_message_id}`);
        console.log('---');
    });
}

dumpRecentMessages();
