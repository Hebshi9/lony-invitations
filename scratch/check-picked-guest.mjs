import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkGuest() {
    const { data, error } = await supabase.from('guests')
        .select('*')
        .eq('id', '9bd5167e-b4f1-4689-8046-0e7b405c67fa')
        .single();
    if (error) console.error(error);
    else console.log('Guest Data:', JSON.stringify(data, null, 2));
}

checkGuest();
