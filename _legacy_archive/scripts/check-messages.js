import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    const results = {};

    const { data: pending } = await supabase.from('whatsapp_messages').select('*').eq('status', 'pending').limit(5);
    results.pending = pending;

    const { data: failed } = await supabase.from('whatsapp_messages').select('*').eq('status', 'failed').limit(5);
    results.failed = failed;

    const { data: accounts } = await supabase.from('whatsapp_accounts').select('*');
    results.accounts = accounts;

    const { data: queue } = await supabase.from('whatsapp_messages').select('status').not('status', 'eq', 'sent');
    // Group by status
    const stats = {};
    queue?.forEach(m => {
        stats[m.status] = (stats[m.status] || 0) + 1;
    });
    results.stats = stats;

    fs.writeFileSync('debug_output.json', JSON.stringify(results, null, 2));
    console.log("Done writing to debug_output.json");
}

check().catch(console.error);
