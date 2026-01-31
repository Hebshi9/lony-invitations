import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testQuery() {
    console.log('Testing getAvailableAccounts query...');

    // 1. Fetch all connected accounts
    const { data: allConnected, error: err1 } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('status', 'connected');

    console.log('All connected accounts:', allConnected?.length);
    if (allConnected?.length > 0) {
        console.log('First account:', allConnected[0]);
    }

    // 2. Test the specific query used in QueueManager
    // .lt('messages_sent_today', supabase.raw('daily_limit')) <-- This is what I suspect

    // Attempting to replicate what might be happening or just fetch and filter in JS
    try {
        // There is no easy way to do column comparison in standard supabase-js .lt() without RPC or raw filter
        // QueueManager uses: .lt('messages_sent_today', supabase.raw('daily_limit'))
        // Let's see if we can even do that via the client library easily or if it fails.
        // Actually, supabase.raw() is not a property of the client instance usually, it's a separate import or part of the query builder if exposed.
        // But here I'll just check if a standard filter works.

        console.log('--- Attempting to filter in JS instead ---');
        const validAccounts = allConnected.filter(a => a.messages_sent_today < a.daily_limit);
        console.log('Valid accounts via JS filter:', validAccounts.length);

    } catch (e) {
        console.error('Error:', e);
    }
}

testQuery();
