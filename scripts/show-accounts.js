import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function getAccountDetails() {
    console.log('📱 WhatsApp Account Details\n');
    console.log('='.repeat(60));

    const { data: accounts } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    if (!accounts || accounts.length === 0) {
        console.log('\n❌ No accounts found in database');
        console.log('\n💡 Next Steps:');
        console.log('   1. Open http://localhost:5173/whatsapp-sender in your browser');
        console.log('   2. Add a new WhatsApp account');
        console.log('   3. Scan the QR code with your phone');
        return;
    }

    console.log(`\n📊 Total Accounts: ${accounts.length}\n`);

    accounts.forEach((acc, index) => {
        console.log(`Account #${index + 1}:`);
        console.log(`   ID: ${acc.id}`);
        console.log(`   Name: ${acc.name}`);
        console.log(`   Phone: ${acc.phone || 'Not set'}`);
        console.log(`   Status: ${acc.status === 'connected' ? '✅ CONNECTED' : '❌ DISCONNECTED'}`);
        console.log(`   Messages Today: ${acc.messages_sent_today || 0}/${acc.daily_limit || 170}`);
        console.log(`   Created: ${new Date(acc.created_at).toLocaleString('ar-SA')}`);
        console.log('');
    });

    const disconnected = accounts.filter(a => a.status !== 'connected');

    if (disconnected.length > 0) {
        console.log('⚠️  Disconnected Accounts Found!\n');
        console.log('💡 To reconnect:');
        console.log('   1. Open http://localhost:5173/whatsapp-sender');
        console.log('   2. Find the disconnected account');
        console.log('   3. Click "اتصال (Scan QR)"');
        console.log('   4. Scan the QR code with WhatsApp on your phone');
        console.log('   5. Wait for connection confirmation');
    } else {
        console.log('✅ All accounts are connected!\n');
        console.log('💡 You can now send messages from the WhatsApp Sender page');
    }

    console.log('\n' + '='.repeat(60));
}

getAccountDetails();
