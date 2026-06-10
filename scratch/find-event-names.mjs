import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvent() {
    const { data: event1, error: err1 } = await supabase
        .from('events')
        .select('id, name, date')
        .eq('id', 'ebdec964-18b4-4025-9a61-76c70d1732c0')
        .single();
        
    const { data: event2, error: err2 } = await supabase
        .from('events')
        .select('id, name, date')
        .eq('id', 'fc3ef9f5-4626-4a9f-aa1d-21058bf37841')
        .single();

    console.log('Event 1 (ebdec964...):', event1 || err1);
    console.log('Event 2 (fc3ef9f5...):', event2 || err2);
}

checkEvent();
