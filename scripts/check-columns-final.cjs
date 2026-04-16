const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    try {
        const { data: guests } = await supabase.from('guests').select('*').limit(1);
        if (guests && guests[0]) {
            console.log('GUESTS_COLUMNS:' + JSON.stringify(Object.keys(guests[0])));
        }

        const { data: msgs } = await supabase.from('whatsapp_messages').select('*').limit(1);
        if (msgs && msgs.length > 0) {
            console.log('MESSAGES_COLUMNS:' + JSON.stringify(Object.keys(msgs[0])));
        }
    } catch (e) {
        console.error(e);
    }
}

run();
