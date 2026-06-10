import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMessage() {
    const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('id', 'd6b8494a-7bfc-4f8a-ba20-4d0e1df53cbb')
        .single();
        
    if (error) {
        console.error('Error fetching message:', error);
    } else {
        console.log('Message details:', JSON.stringify(data, null, 2));
    }
}

checkMessage();
