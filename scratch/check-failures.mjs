
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkFailures() {
    const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1';
    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('event_id', eventId)
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    
    console.log('Failed Messages:', JSON.stringify(data, null, 2));
}

checkFailures();
