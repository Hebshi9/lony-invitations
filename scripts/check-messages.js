import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMessages() {
    console.log('🔍 Checking WhatsApp messages status...\n');

    // Get all messages
    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.log(`📊 Found ${messages.length} messages:\n`);

    messages.forEach((msg, i) => {
        console.log(`${i + 1}. Phone: ${msg.phone}`);
        console.log(`   Status: ${msg.status}`);
        console.log(`   Message: ${msg.message_text.substring(0, 50)}...`);
        console.log(`   Error: ${msg.error_message || 'None'}`);
        console.log(`   Created: ${msg.created_at}`);
        console.log('');
    });

    // Get accounts
    const { data: accounts } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    console.log(`\n📱 WhatsApp Accounts (${accounts?.length || 0}):`);
    accounts?.forEach(acc => {
        console.log(`- ${acc.name} (${acc.phone}): ${acc.status}`);
        console.log(`  Messages today: ${acc.messages_sent_today}/${acc.daily_limit}`);
    });
}

checkMessages();
