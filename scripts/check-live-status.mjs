import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function checkLiveStatus() {
    console.log("Checking database live status...");
    
    // 1. Get total guest counts
    const { data: guests, error: err1 } = await supabase
        .from('guests')
        .select('id, name, status, rsvp_status, checked_in')
        .eq('event_id', EVENT_ID);

    if (err1) {
        console.error("Error fetching guests:", err1);
        return;
    }

    // 2. Get total message counts
    const { data: messages, error: err2 } = await supabase
        .from('whatsapp_messages')
        .select('id, status, delivery_status, message_phase')
        .eq('event_id', EVENT_ID);

    if (err2) {
        console.error("Error fetching messages:", err2);
        return;
    }

    const rsvpCounts = {
        confirmed: 0,
        declined: 0,
        maybe: 0,
        pending: 0
    };

    guests.forEach(g => {
        const rsvp = g.rsvp_status || 'pending';
        if (rsvpCounts[rsvp] !== undefined) {
            rsvpCounts[rsvp]++;
        } else {
            rsvpCounts.pending++;
        }
    });

    const msgCounts = {};
    messages.forEach(m => {
        const key = `${m.message_phase || 'unknown'}:${m.delivery_status || m.status || 'unknown'}`;
        msgCounts[key] = (msgCounts[key] || 0) + 1;
    });

    console.log("\n=============================================");
    console.log("📊 LIVE SYSTEM STATUS REPORT");
    console.log("=============================================");
    console.log(`Total Guests in Database: ${guests.length}`);
    console.log(`RSVP Statuses:`);
    console.log(`  - Confirmed (مؤكد): ${rsvpCounts.confirmed}`);
    console.log(`  - Declined (معتذر): ${rsvpCounts.declined}`);
    console.log(`  - Maybe (ربما): ${rsvpCounts.maybe}`);
    console.log(`  - Pending (لم يردوا بعد): ${rsvpCounts.pending}`);
    console.log(`---------------------------------------------`);
    console.log("Messages Delivery Log:");
    Object.entries(msgCounts).forEach(([key, count]) => {
        console.log(`  - ${key}: ${count}`);
    });
    console.log("=============================================\n");
}

checkLiveStatus();
