import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function listAllEvents() {
    const { data: events, error } = await supabase
        .from('events')
        .select('id, name, groom_name, bride_name, date, venue, location, created_at')
        .order('created_at', { ascending: false })
        .limit(8);

    if (error) {
        console.error('Error fetching events:', error);
        return;
    }

    console.log(`\nFound ${events.length} events:`);
    events.forEach((e, idx) => {
        console.log(`[${idx + 1}] ID: ${e.id}`);
        console.log(`    Name: ${e.name}`);
        console.log(`    Groom: ${e.groom_name} | Bride: ${e.bride_name}`);
        console.log(`    Date: ${e.date} | Venue: ${e.venue}`);
        console.log(`    Created At: ${e.created_at}`);
        console.log('---------------------------------------------');
    });
}

listAllEvents();
