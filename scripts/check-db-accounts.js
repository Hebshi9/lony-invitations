import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDB() {
    console.log('🔍 Checking WhatsApp Accounts in DB...');

    const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    if (error) {
        console.error('❌ DB Error:', error.message);
    } else {
        console.log(`✅ Found ${data.length} accounts:`);
        console.table(data);
    }
}

checkDB();
