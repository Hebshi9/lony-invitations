import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkData() {
    const { data: events, error } = await supabase.from('events').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Events:', events);
        if (events.length === 0) {
            // Create a test event
            const { data: newEvent, error: createError } = await supabase
                .from('events')
                .insert({
                    name: 'Test Event',
                    date: '2025-01-01',
                    token: 'TEST-1234'
                })
                .select()
                .single();

            if (createError) console.error('Create Error:', createError);
            else console.log('Created Test Event:', newEvent);
        }
    }
}

checkData();
