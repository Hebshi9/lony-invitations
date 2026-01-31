import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDatabase() {
    console.log('Verifying Supabase Connection...');

    // 1. Check Events Table
    const { data: events, error: eventError } = await supabase.from('events').select('count', { count: 'exact', head: true });
    if (eventError) {
        console.error('❌ Events Table Error:', eventError.message);
    } else {
        console.log('✅ Events Table Connected. Count:', events);
    }

    // 2. Try Insert (Test Event)
    const testEvent = {
        name: 'Test Event ' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        venue: 'Debug Venue',
        token: 'DBG-' + Math.floor(Math.random() * 1000)
    };

    const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert(testEvent)
        .select()
        .single();

    if (insertError) {
        console.error('❌ Insert Failed (RLS Issue?):', insertError.message);
    } else {
        console.log('✅ Insert Successful:', insertedEvent);

        // Cleanup
        await supabase.from('events').delete().eq('id', insertedEvent.id);
        console.log('✅ Cleanup Successful');
    }
}

verifyDatabase();
