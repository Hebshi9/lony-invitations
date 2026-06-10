import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function checkEvent() {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', EVENT_ID)
        .single();
        
    if (error) {
        console.error('Error fetching event:', error);
    } else {
        console.log('Event details:', JSON.stringify(data, null, 2));
    }
}

checkEvent();
