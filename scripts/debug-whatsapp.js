import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function debugRequest() {
    console.log('--- WhatsApp Debugger ---');

    // 1. Direct DB Insert Test
    console.log('\n[1] Testing Direct DB Insert...');
    const testPhone = `+966${Math.floor(Math.random() * 1000000000)}`;
    try {
        const { data, error } = await supabase
            .from('whatsapp_accounts')
            .insert([{
                phone: testPhone,
                name: 'Debug Test',
                status: 'disconnected'
            }])
            .select()
            .single();

        if (error) {
            console.log('❌ DB Insert Failed:', error.message);
            if (error.message.includes('relation "whatsapp_accounts" does not exist')) {
                console.log('   -> CRITICAL: The table `whatsapp_accounts` does not exist!');
            }
        } else {
            console.log('✅ DB Insert Success:', data);

            // Cleanup
            await supabase.from('whatsapp_accounts').delete().eq('id', data.id);
        }
    } catch (e) {
        console.log('❌ DB Exception:', e.message);
    }

    // 2. API Endpoint Test
    console.log('\n[2] Testing API Endpoint (http://127.0.0.1:3001)...');
    try {
        const response = await fetch('http://127.0.0.1:3001/api/whatsapp/accounts', {
            method: 'GET'
        });

        if (response.ok) {
            const json = await response.json();
            console.log('✅ API Reachable. Response:', json.success ? 'Success' : 'Failed', `(${json.accounts?.length} accounts)`);
        } else {
            console.log('❌ API Error:', response.status, response.statusText);
        }
    } catch (e) {
        console.log('❌ API Connection Failed:', e.message);
        console.log('   -> Hints: Is the server running? Is port 3001 open?');
    }
    console.log('-------------------------');
}

debugRequest();
