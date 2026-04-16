const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log('--- Searching for recent Webhook Logs (Last 10) ---');
    const { data: logs } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    for (const log of logs) {
        console.log(`[${log.created_at}] Payload ID: ${log.id}`);
        // console.log(JSON.stringify(log.payload, null, 2));
        const entry = log.payload?.entry?.[0];
        const changes = entry?.changes?.[0]?.value;
        if (changes?.messages) {
           console.log('   - MESSAGE interaction found!');
           console.log(`   - From: ${changes.messages[0].from}`);
           console.log(`   - Type: ${changes.messages[0].type}`);
           if (changes.messages[0].button) console.log(`   - Button Text: ${changes.messages[0].button.text}`);
           if (changes.messages[0].interactive) console.log(`   - Interactive Text: ${changes.messages[0].interactive.button_reply?.title}`);
        } else if (changes?.statuses) {
           console.log(`   - Status Update: ${changes.statuses[0].recipient_id} -> ${changes.statuses[0].status}`);
        }
    }

    console.log('\n--- Checking User Guest record status ---');
    const { data: guests } = await supabase.from('guests').select('name, phone, rsvp_status, updated_at').ilike('phone', '%503678789%');
    console.log('Current Guest Status:', JSON.stringify(guests, null, 2));
}

run();
