import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function quickCheck() {
    console.log('🔍 Quick WhatsApp Check\n');

    // Check Accounts
    const { data: accounts } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    console.log(`📱 Accounts: ${accounts?.length || 0}`);
    if (accounts && accounts.length > 0) {
        accounts.forEach(acc => {
            console.log(`   ${acc.status === 'connected' ? '✅' : '❌'} ${acc.name} - ${acc.status}`);
        });
    } else {
        console.log('   ⚠️  No accounts found');
    }

    // Check Messages
    const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('status')
        .limit(100);

    const stats = {};
    messages?.forEach(m => {
        stats[m.status] = (stats[m.status] || 0) + 1;
    });

    console.log('\n📨 Messages (last 100):');
    Object.entries(stats).forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
    });

    console.log('\n✅ Done\n');
}

quickCheck();
