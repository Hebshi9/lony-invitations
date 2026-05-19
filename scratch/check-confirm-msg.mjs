import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkMessage() {
    const { data, error } = await supabase.from('whatsapp_messages')
        .select('*')
        .eq('evolution_message_id', 'wamid.HBgMOTY2NTAzNjc4Nzg5FQIAERgSQTU1NDNCQzhENDY1OTNBREIxAA==')
        .single();
    if (error) console.error(error);
    else console.log('Message Log:', JSON.stringify(data, null, 2));
}

checkMessage();
