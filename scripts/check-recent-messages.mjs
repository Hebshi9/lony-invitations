import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkSentMessages() {
    console.log('Checking for messages sent in the last 2 minutes...');
    const now = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase.from('whatsapp_messages')
        .select('*')
        .gte('created_at', now)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log(`\n✅ Found ${data.length} recent messages:`);
        data.forEach(m => {
            console.log(`- Type: ${m.message_phase} | Phone: ${m.phone} | Status: ${m.delivery_status}`);
            console.log(`  Content: ${m.message_text}`);
        });
    } else {
        console.log('No recent messages found. The server received the webhook but failed to trigger the send logic.');
    }
}

checkSentMessages();
