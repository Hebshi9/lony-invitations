import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function readAccounts() {
    console.log('🔍 Querying whatsapp_accounts...');
    const { data, error } = await supabase.from('whatsapp_accounts').select('*');
    if (error) {
        console.error('Error fetching whatsapp_accounts:', error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

readAccounts();
