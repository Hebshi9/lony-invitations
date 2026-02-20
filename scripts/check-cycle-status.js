import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkStatus() {
    console.log('🔍 Checking Database Status...\n');

    // 1. Get Events
    const { data: events, error: eError } = await supabase.from('events').select('id, name').limit(5);
    if (eError) {
        console.error('❌ Error fetching events:', eError.message);
        return;
    }

    if (!events || events.length === 0) {
        console.log('ℹ️ No events found.');
        return;
    }

    console.log('✅ Found Events:');
    for (const event of events) {
        const { count, error: cError } = await supabase
            .from('guests')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

        console.log(`- ${event.name} (ID: ${event.id}) | Guests: ${count || 0}`);
    }

    // 2. Check WhatsApp Accounts
    console.log('\n📱 Checking WhatsApp Accounts...');
    const API_URL = 'http://localhost:3001/api/whatsapp';
    try {
        const res = await fetch(`${API_URL}/accounts`);
        const data = await res.json();
        console.log('✅ WhatsApp API Status: Accessible');
        console.log('Accounts:', JSON.stringify(data.accounts, null, 2));
    } catch (err) {
        console.log('❌ WhatsApp API Status: Offline (or not accessible on port 3001)');
    }
}

checkStatus();
