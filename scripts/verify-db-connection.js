import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    console.log('🔍 Verifying Database Connection & Schema...');
    console.log(`URL: ${supabaseUrl}`);

    // 1. Check Events
    console.log('\n--- Checking Events ---');
    const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .limit(1);

    if (eventsError) {
        console.error('❌ Error fetching events:', eventsError.message);
    } else {
        console.log(`✅ Fetched ${events.length} events`);
        if (events.length > 0) {
            console.log('Columns found:', Object.keys(events[0]).join(', '));
            // Check for new columns
            const required = ['client_id', 'start_date', 'end_date'];
            const missing = required.filter(col => !Object.keys(events[0]).includes(col));
            if (missing.length === 0) {
                console.log('✅ All new columns present in Events');
            } else {
                console.error('❌ Missing columns in Events:', missing.join(', '));
            }
        } else {
            console.warn('⚠️ No events found. Cannot verify columns.');
        }
    }

    // 2. Check Guests
    console.log('\n--- Checking Guests ---');
    const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .limit(1);

    if (guestsError) {
        console.error('❌ Error fetching guests:', guestsError.message);
    } else {
        console.log(`✅ Fetched ${guests.length} guests`);
        if (guests.length > 0) {
            console.log('Columns found:', Object.keys(guests[0]).join(', '));
            const required = ['companions_count', 'max_scans'];
            const missing = required.filter(col => !Object.keys(guests[0]).includes(col));
            if (missing.length === 0) {
                console.log('✅ All new columns present in Guests');
            } else {
                console.error('❌ Missing columns in Guests:', missing.join(', '));
            }
        }
    }

    // 3. Check Scans
    console.log('\n--- Checking Scans ---');
    const { data: scans, error: scansError } = await supabase
        .from('scans')
        .select('*')
        .limit(1);

    if (scansError) {
        console.error('❌ Error fetching scans:', scansError.message);
    } else {
        console.log(`✅ Fetched ${scans.length} scans`);
        if (scans.length > 0) {
            console.log('Columns found:', Object.keys(scans[0]).join(', '));
        }
    }
}

verify();
