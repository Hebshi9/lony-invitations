
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStatus() {
    const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- WhatsApp Accounts Status ---');
    data.forEach(acc => {
        console.log(`ID: ${acc.id}`);
        console.log(`Name: ${acc.name}`);
        console.log(`Phone: ${acc.phone}`);
        console.log(`Status: ${acc.status}`);
        console.log('--------------------------------');
    });
}

checkStatus();
