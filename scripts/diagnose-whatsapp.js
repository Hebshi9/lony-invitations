import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function diagnose() {
    console.log('🔍 Diagnosing WhatsApp Setup...\n');

    // 1. Check server is running
    console.log('1. Checking WhatsApp Server...');
    try {
        const res = await fetch('http://localhost:3001/api/whatsapp/accounts');
        const data = await res.json();
        console.log('✅ Server responding');
        console.log('Accounts:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('❌ Server not responding:', e.message);
        return;
    }

    // 2. Check WhatsApp accounts
    console.log('\n2. Checking WhatsApp Accounts in DB...');
    const { data: accounts, error: accError } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    if (accError) {
        console.log('❌ Error:', accError.message);
    } else {
        console.log(`Found ${accounts.length} accounts:`);
        accounts.forEach(acc => {
            console.log(`  - ${acc.name}: Status=${acc.status}, Phone=${acc.phone || 'N/A'}`);
        });
    }

    // 3. Check if there are guests with phone numbers
    console.log('\n3. Checking Guests...');
    const { data: guests, error: guestError } = await supabase
        .from('guests')
        .select('id, name, phone, event_id')
        .not('phone', 'is', null)
        .limit(5);

    if (guestError) {
        console.log('❌ Error:', guestError.message);
    } else {
        console.log(`Found ${guests.length} guests with phones (showing first 5):`);
        guests.forEach(g => {
            console.log(`  - ${g.name}: ${g.phone} (Event: ${g.event_id?.slice(0, 8)}...)`);
        });
    }

    // 4. Check pending messages
    console.log('\n4. Checking Pending Messages...');
    const { data: messages, error: msgError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('status', 'pending')
        .limit(5);

    if (msgError) {
        console.log('❌ Error:', msgError.message);
    } else {
        console.log(`Found ${messages.length} pending messages (showing first 5):`);
        messages.forEach(m => {
            console.log(`  - To: ${m.phone}, Event: ${m.event_id?.slice(0, 8)}..., Phase: ${m.message_phase}`);
        });
    }

    // 5. Summary
    console.log('\n📊 SUMMARY:');
    const connectedAccounts = accounts?.filter(a => a.status === 'connected') || [];
    console.log(`✓ Connected WhatsApp Accounts: ${connectedAccounts.length}`);
    console.log(`✓ Guests with phones: ${guests?.length || 0}`);
    console.log(`✓ Pending messages: ${messages?.length || 0}`);

    if (connectedAccounts.length === 0) {
        console.log('\n⚠️  NO CONNECTED WHATSAPP ACCOUNTS!');
        console.log('   → Go to /whatsapp-sender and scan QR code to connect');
    }

    if (!messages || messages.length === 0) {
        console.log('\n⚠️  NO PENDING MESSAGES!');
        console.log('   → Click "إرسال الحملة الآن" to prepare messages');
    }
}

diagnose().catch(console.error);
