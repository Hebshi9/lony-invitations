import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const realSupabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function checkRealRecentLog() {
    const phone = '966503678789';
    console.log(`🔍 Checking REAL invitation log for ${phone}...`);
    
    const { data, error } = await realSupabase.from('whatsapp_messages')
        .select('*')
        .eq('phone', phone)
        .eq('message_phase', 'invitation') // Corrected phase name
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        const m = data[0];
        console.log(`✅ Found Log: ID=${m.id} | WAMID=${m.evolution_message_id || 'MISSING'}`);
        console.log(`Created At: ${m.created_at}`);
    } else {
        console.log('❌ Still no invitation log found for this phone with phase "invitation".');
    }
}

checkRealRecentLog();
