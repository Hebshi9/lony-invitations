
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Config in .env');
    process.exit(1);
}

console.log('Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching guests with missing tokens...');

    // Select guests where qr_token is null
    const { data: guests, error } = await supabase
        .from('guests')
        .select('*') // Select all to see
        .is('qr_token', null);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (!guests || guests.length === 0) {
        console.log('No guests found with missing tokens. Use valid query?');
        // Double check if any guests exist
        const { count } = await supabase.from('guests').select('*', { count: 'exact', head: true });
        console.log(`Total guests in DB: ${count}`);
        return;
    }

    console.log(`Found ${guests.length} guests missing tokens. Updating...`);

    for (const guest of guests) {
        const token = crypto.randomUUID();
        const { error: updateError } = await supabase
            .from('guests')
            .update({ qr_token: token })
            .eq('id', guest.id);

        if (updateError) console.error(`Failed ${guest.id}:`, updateError.message);
        else console.log(`Updated ${guest.id} with token ${token}`);
    }
    console.log('Done.');
}

run();
