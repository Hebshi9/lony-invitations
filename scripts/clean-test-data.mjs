import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function cleanTestData() {
    const phone = '966503678789'; // Your admin/test phone
    console.log(`🧹 Cleaning test data for phone: ${phone}`);
    
    // 1. Get guest ID
    const { data: guests } = await supabase.from('guests').select('id').eq('phone', phone);
    
    if (guests && guests.length > 0) {
        const ids = guests.map(g => g.id);
        console.log(`Found guest IDs: ${ids.join(', ')}`);
        
        // 2. Delete messages
        const { error: msgError } = await supabase.from('whatsapp_messages').delete().in('guest_id', ids);
        if (msgError) console.error('Error deleting messages:', msgError);
        else console.log('✅ Messages deleted.');
        
        // 3. Reset status
        const { error: guestError } = await supabase.from('guests').update({ status: 'idle' }).in('id', ids);
        if (guestError) console.error('Error resetting guest status:', guestError);
        else console.log('✅ Guest status reset to idle.');
    } else {
        console.log('No guests found with this phone.');
    }
}

cleanTestData();
