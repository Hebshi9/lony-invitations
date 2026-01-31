import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkPhoneNumbers() {
    console.log('--- Checking Phone Numbers ---\n');

    // Get sample guests with phone numbers
    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, phone')
        .not('phone', 'is', null)
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Sample phone numbers from database:\n');
    guests.forEach((guest, i) => {
        console.log(`${i + 1}. ${guest.name}: ${guest.phone}`);
    });

    // Check WhatsApp messages
    console.log('\n--- WhatsApp Messages Status ---\n');
    const { data: messages, error: msgError } = await supabase
        .from('whatsapp_messages')
        .select('phone, status, error_message, sent_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (msgError) {
        console.error('Error:', msgError);
        return;
    }

    console.log('Recent messages:\n');
    messages.forEach((msg, i) => {
        console.log(`${i + 1}. Phone: ${msg.phone}`);
        console.log(`   Status: ${msg.status}`);
        console.log(`   Sent: ${msg.sent_at || 'Not sent'}`);
        if (msg.error_message) {
            console.log(`   Error: ${msg.error_message}`);
        }
        console.log('');
    });
}

checkPhoneNumbers();
