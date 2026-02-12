
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function debugDB() {
    console.log('--- Database Debug ---');

    // Check tables by trying to select from them
    const tables = ['whatsapp_replies', 'whatsapp_rsvp', 'guests'];

    for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`❌ Table "${table}": Error - ${error.message}`);
        } else {
            console.log(`✅ Table "${table}": Exists`);
            if (data && data.length > 0) {
                console.log(`   Columns in "${table}": ${Object.keys(data[0]).join(', ')}`);
            }
        }
    }
}

debugDB();
