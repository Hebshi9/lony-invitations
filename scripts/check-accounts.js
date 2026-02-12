import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- Checking whatsapp_accounts ---');
    const { data, error } = await supabase.from('whatsapp_accounts').select('*');
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Accounts count:', data.length);
        console.log('Accounts data:', JSON.stringify(data, null, 2));
    }
}

check();
