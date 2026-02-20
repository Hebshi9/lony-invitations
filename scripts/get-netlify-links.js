
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function getLinks() {
    console.log('Fetching guests...');
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select('name, qr_token, events(name)')
            .limit(5)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error:', error);
            process.exit(1);
        }

        console.log('\n--- Netlify Links (Latest 5 Guests) ---');
        if (!guests || guests.length === 0) {
            console.log('No guests found.');
        } else {
            guests.forEach(guest => {
                const eventName = guest.events ? guest.events.name : 'Unknown Event';
                const link = `https://lonyinvite.netlify.app/check-in.html?token=${guest.qr_token}`;
                console.log(`Guest: ${guest.name} (${eventName})`);
                console.log(`Link: ${link}`);
                console.log('---');
            });
        }
    } catch (err) {
        console.error('Exception:', err);
    }
    process.exit(0);
}

getLinks();
