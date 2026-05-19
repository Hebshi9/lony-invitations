import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const realSupabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkLogByGuestId() {
    const guestId = '6e90b323-6bc5-4f80-9117-2ab727f20772';
    console.log(`🔍 Checking logs for guest ID: ${guestId}...`);
    
    const { data, error } = await realSupabase.from('whatsapp_messages')
        .select('*')
        .eq('guest_id', guestId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        const m = data[0];
        console.log(`✅ Found Log! Phase: ${m.message_phase} | Status: ${m.status}`);
        console.log(`WAMID: ${m.evolution_message_id || 'MISSING'}`);
        console.log(`Created At: ${m.created_at}`);
    } else {
        console.log('❌ Still no logs found even for this Guest ID.');
    }
}

checkLogByGuestId();
