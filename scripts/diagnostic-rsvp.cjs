const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const phoneNumber = '503678789'; // User's phone snippet
    console.log(`--- Searching for Guest with phone like %${phoneNumber}% ---`);
    
    const { data: guests, error } = await supabase
        .from('guests')
        .select('*, events(name)')
        .or(`phone.ilike.%${phoneNumber}%`);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (guests.length === 0) {
        console.log('No guests found with that phone number.');
    } else {
        console.log('Guests found:', JSON.stringify(guests, null, 2));
    }

    console.log('--- Checking recent Webhook Logs ---');
    const { data: logs } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    
    console.log('Recent Webhook Logs:', JSON.stringify(logs, null, 2));
}

run();
