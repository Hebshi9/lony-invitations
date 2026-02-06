import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function diagnose() {
    console.log('🔍 WhatsApp System Diagnosis\n');
    console.log('='.repeat(50));

    // 1. Check Server
    console.log('\n📡 1. Checking Server...');
    try {
        const response = await fetch('http://localhost:3001/api/whatsapp/debug');
        const data = await response.json();
        console.log('✅ Server is running');
        console.log('   Active Clients:', data.info.activeClients.length);
        console.log('   Queue Running:', data.info.queueStatus.isRunning);
        console.log('   Queue Paused:', data.info.queueStatus.isPaused);
    } catch (error) {
        console.log('❌ Server not reachable:', error.message);
        return;
    }

    // 2. Check Accounts
    console.log('\n📱 2. Checking WhatsApp Accounts...');
    const { data: accounts, error: accError } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    if (accError) {
        console.log('❌ Error fetching accounts:', accError.message);
    } else {
        console.log(`   Total Accounts: ${accounts.length}`);
        accounts.forEach(acc => {
            console.log(`   - ${acc.name} (${acc.phone})`);
            console.log(`     Status: ${acc.status}`);
            console.log(`     Messages Today: ${acc.messages_sent_today}/${acc.daily_limit}`);
        });
    }

    // 3. Check Messages
    console.log('\n📨 3. Checking Messages...');
    const { data: messages, error: msgError } = await supabase
        .from('whatsapp_messages')
        .select('status, message_phase')
        .order('created_at', { ascending: false })
        .limit(100);

    if (msgError) {
        console.log('❌ Error fetching messages:', msgError.message);
    } else {
        const stats = {
            pending: 0,
            queued: 0,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0
        };

        messages.forEach(msg => {
            stats[msg.status] = (stats[msg.status] || 0) + 1;
        });

        console.log('   Message Statistics (last 100):');
        Object.entries(stats).forEach(([status, count]) => {
            if (count > 0) {
                console.log(`   - ${status}: ${count}`);
            }
        });
    }

    // 4. Recommendations
    console.log('\n💡 4. Recommendations:');

    const connectedAccounts = accounts?.filter(a => a.status === 'connected') || [];
    if (connectedAccounts.length === 0) {
        console.log('   ⚠️  No connected WhatsApp accounts');
        console.log('   → Go to http://localhost:5173/whatsapp-sender');
        console.log('   → Add an account and scan QR code');
    } else {
        console.log(`   ✅ ${connectedAccounts.length} account(s) connected`);
    }

    const pendingMessages = messages?.filter(m => m.status === 'pending') || [];
    if (pendingMessages.length > 0) {
        console.log(`   📬 ${pendingMessages.length} pending messages ready to send`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Diagnosis Complete\n');
}

diagnose().catch(console.error);
