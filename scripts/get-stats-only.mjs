import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = '0d9d3de0-562e-443f-8d57-4d9b653db4bf';

async function getStatsOnly() {
    const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', EVENT_ID);
        
    if (guestsError) {
        console.error('Error fetching guests:', guestsError);
        return;
    }

    const statusCounts = {};
    const rsvpCounts = {};
    guests.forEach(g => {
        statusCounts[g.status] = (statusCounts[g.status] || 0) + 1;
        rsvpCounts[g.rsvp_status] = (rsvpCounts[g.rsvp_status] || 0) + 1;
    });

    console.log('\n=============================================');
    console.log(`📊 Statistics for Mohamed & Atheer (Event ID: ${EVENT_ID})`);
    console.log(`👥 Total Guests in DB: ${guests.length}`);
    console.log('\n--- Guests Table RSVP Status ---');
    console.log(JSON.stringify(rsvpCounts, null, 2));
    console.log('\n--- Guests Table Delivery Status ---');
    console.log(JSON.stringify(statusCounts, null, 2));
    console.log('=============================================');
}

getStatsOnly();
