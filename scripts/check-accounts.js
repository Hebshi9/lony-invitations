import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAccounts() {
    console.log('--- WhatsApp Accounts ---\n');

    const { data: accounts, error } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    accounts.forEach((acc, i) => {
        console.log(`${i + 1}. ${acc.name || 'Unnamed'}`);
        console.log(`   Phone: ${acc.phone}`);
        console.log(`   Status: ${acc.status}`);
        console.log(`   Created: ${acc.created_at}`);
        console.log('');
    });

    console.log('--- Guest Phone Numbers (Sample) ---\n');
    const { data: guests } = await supabase
        .from('guests')
        .select('name, phone')
        .not('phone', 'is', null)
        .limit(5);

    guests.forEach((g, i) => {
        console.log(`${i + 1}. ${g.name}: ${g.phone}`);
    });
}

checkAccounts();
