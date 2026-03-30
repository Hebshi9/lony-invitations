import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function verify() {
    console.log('🔍 Checking replacement schema...\n');

    // 1. Check client_phone column in events
    const { data: events, error: evErr } = await supabase
        .from('events')
        .select('id, name, client_phone')
        .limit(3);

    if (evErr) {
        console.error('❌ events table error:', evErr.message);
        if (evErr.message.includes('client_phone')) {
            console.error('   → client_phone column does NOT exist!');
        }
    } else {
        console.log('✅ events.client_phone column exists');
        console.log('   Events:', events?.map(e => `${e.name} (phone: ${e.client_phone || 'not set'})`).join(', '));
    }

    // 2. Check pending_replacements table
    const { data: pr, error: prErr } = await supabase
        .from('pending_replacements')
        .select('id')
        .limit(1);

    if (prErr) {
        console.error('❌ pending_replacements table error:', prErr.message);
    } else {
        console.log('✅ pending_replacements table exists');
    }

    // 3. Check guest_replacements table
    const { data: gr, error: grErr } = await supabase
        .from('guest_replacements')
        .select('id')
        .limit(1);

    if (grErr) {
        console.error('❌ guest_replacements table error:', grErr.message);
    } else {
        console.log('✅ guest_replacements table exists');
    }

    console.log('\n📊 Done!');
}

verify().catch(console.error);
