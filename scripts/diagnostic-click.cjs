const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const phoneNumber = '966503678789'; 
    console.log(`--- Searching for Guest: ${phoneNumber} ---`);
    const { data: guests } = await supabase.from('guests').select('*, events(name)').eq('phone', phoneNumber);
    console.log('Guests:', JSON.stringify(guests, null, 2));

    console.log('--- Searching for Message interactions (button clicks) ---');
    const { data: logs } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    const buttonClicks = logs.filter(l => {
        const entry = l.payload?.entry?.[0];
        const changes = entry?.changes?.[0]?.value;
        return changes?.messages?.[0]?.button || changes?.messages?.[0]?.interactive;
    });

    console.log('Recent Button Click Payloads:', JSON.stringify(buttonClicks, null, 2));
}

run();
