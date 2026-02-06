import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkRecentActivity() {
    console.log('🔍 Checking recent DB activity...');

    // 1. Check Sales Conversations (Last 10 mins)
    const { data: convs, error: convError } = await supabase
        .from('sales_conversations')
        .select('*')
        .order('last_contact_at', { ascending: false })
        .limit(3);

    console.log('\n💬 Recent Conversations:', convError ? convError.message : convs);

    // 2. Check Sales Messages (Last 10 mins)
    const { data: msgs, error: msgError } = await supabase
        .from('sales_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('\n📨 Recent Messages:', msgError ? msgError.message : msgs);

    // 3. Check WhatsApp Tables (just in case)
    const { data: wa_accts } = await supabase.from('whatsapp_accounts').select('*');
    console.log('\n📱 Connected Accounts:', wa_accts);
}

checkRecentActivity();
