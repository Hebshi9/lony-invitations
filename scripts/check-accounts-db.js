import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAccounts() {
    console.log('🔍 Checking WhatsApp Accounts in Database...\n');

    const { data: accounts, error } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (!accounts || accounts.length === 0) {
        console.log('ℹ️ No accounts found in table.');
    } else {
        for (const acc of accounts) {
            console.log(`- ${acc.name} (${acc.phone}) | Status: ${acc.status} | ID: ${acc.id}`);
        }
    }
}

checkAccounts();
