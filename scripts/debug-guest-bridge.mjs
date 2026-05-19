import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function debugGuest() {
    console.log('Checking all guests matching %503678789 with pending data...');
    const { data, error } = await supabase.from('guests')
        .select('id, name, phone, status, pending_marketing_data, created_at')
        .ilike('phone', '%503678789')
        .not('pending_marketing_data', 'is', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} matches.`);
    data.forEach(g => {
        console.log(`- ID: ${g.id} | Name: ${g.name} | Status: ${g.status} | Created: ${g.created_at} | Data: ${g.pending_marketing_data ? 'YES' : 'NO'}`);
    });
}

debugGuest();
