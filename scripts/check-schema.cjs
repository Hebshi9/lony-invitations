const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
    const { data: cols } = await supabase.from('whatsapp_messages').select('*').limit(1);
    if (cols && cols.length > 0) {
        console.log('Columns in whatsapp_messages:', Object.keys(cols[0]));
    }
    const { data: guests } = await supabase.from('guests').select('*').ilike('phone', '%503678789%');
    console.log('Guest records for user:', JSON.stringify(guests, null, 2));
}
run();
