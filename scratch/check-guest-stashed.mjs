import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function checkGuests() {
    console.log('🔍 Querying guest pending marketing data...');
    const { data: guests, error } = await supabase
        .from('guests')
        .select('name, phone, pending_marketing_data')
        .eq('event_id', EVENT_ID);
        
    if (error) {
        console.error('Error:', error);
        return;
    }
    
    guests.forEach(g => {
        console.log(`\n👤 Guest: ${g.name} (${g.phone})`);
        console.log('Stashed Template:', g.pending_marketing_data?.template?.name || 'NULL');
        console.log('Stashed Payload:', JSON.stringify(g.pending_marketing_data, null, 2));
    });
}

checkGuests();
