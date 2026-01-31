import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugEvents() {
    console.log('Checking events table...');
    const { data: events, error } = await supabase.from('events').select('*');

    if (error) {
        console.error('Error fetching events:', error);
    } else {
        console.log(`Found ${events.length} events:`);
        console.log(JSON.stringify(events, null, 2));
    }

    // Try to insert a test event to verify permissions
    console.log('Attempting to insert test event...');
    const { data: newEvent, error: insertError } = await supabase
        .from('events')
        .insert({
            name: 'Debug Event ' + Date.now(),
            date: '2025-01-01',
            venue: 'Debug Venue',
            token: 'DBG-' + Math.floor(Math.random() * 1000)
        })
        .select();

    if (insertError) {
        console.error('Insert failed:', insertError);
    } else {
        console.log('Insert successful:', newEvent);
    }
}

debugEvents();
