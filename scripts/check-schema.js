import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // I hope uuid is installed, it was in package.json

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
    console.log('--- Schema Verification ---');

    // Try dummy insert into whatsapp_accounts with UUID
    const testId = '42fb396f-4b6a-4ef8-9a96-b9e666871d7c'; // One more than the existing one
    const { error: accError } = await supabase.from('whatsapp_accounts').insert({
        id: testId,
        phone: '+1234567890',
        name: 'Test Account UUID',
        daily_limit: 100
    });

    if (accError) {
        console.log('whatsapp_accounts UUID insert test error:', accError.message);
    } else {
        console.log('whatsapp_accounts UUID insert test: SUCCESS');
        // Cleanup
        await supabase.from('whatsapp_accounts').delete().eq('id', testId);
    }

    // Try dummy insert without ID
    const { data: noIdData, error: noIdError } = await supabase.from('whatsapp_accounts').insert({
        phone: '+9998887776',
        name: 'Test No ID',
        daily_limit: 100
    }).select();

    if (noIdError) {
        console.log('whatsapp_accounts NO ID insert test error:', noIdError.message);
    } else {
        console.log('whatsapp_accounts NO ID insert test: SUCCESS, generated ID:', noIdData[0].id);
        // Cleanup
        await supabase.from('whatsapp_accounts').delete().eq('id', noIdData[0].id);
    }
}

check();
