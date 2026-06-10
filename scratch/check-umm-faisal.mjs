import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGuest() {
    const { data: guests, error } = await supabase
        .from('guests')
        .select('id, name, qr_token, card_image_url')
        .eq('name', 'ام فيصل')
        .eq('event_id', 'fc3ef9f5-4626-4a9f-aa1d-21058bf37841');

    console.log('Umm Faisal guest record:', guests || error);
}

checkGuest();
