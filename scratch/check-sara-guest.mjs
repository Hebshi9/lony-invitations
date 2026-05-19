import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkGuest() {
    const { data, error } = await supabase.from('guests')
        .select('*')
        .ilike('phone', '%097')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (error) console.error(error);
    else console.log('Guest Data for Sara:', JSON.stringify(data, null, 2));
}

checkGuest();
