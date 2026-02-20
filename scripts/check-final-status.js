import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkFinalStatus(eventId) {
    console.log(`📊 Checking Final Message Status for Event: ${eventId}\n`);

    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('status, phone, error_message')
        .eq('event_id', eventId);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    const stats = messages.reduce((acc, m) => {
        acc[m.status] = (acc[m.status] || 0) + 1;
        return acc;
    }, {});

    console.log('✅ Message Stats:', JSON.stringify(stats, null, 2));

    for (const m of messages) {
        console.log(`- ${m.phone}: ${m.status} | Error: ${m.error_message || 'None'}`);
    }
}

const TEST_EVENT_ID = 'fbb9013e-1b3b-4b7e-901c-e3bee46ee0b7';
checkFinalStatus(TEST_EVENT_ID);
