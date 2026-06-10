import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = '049fbefa-18bd-489d-b38d-7502a186d444';

async function checkEventFailures() {
    console.log(`Checking failures for Event ID: ${EVENT_ID} (سلطان & وجدان)...`);

    // 1. Get failed guests
    const { data: failedGuests, error: err1 } = await supabase
        .from('guests')
        .select('id, name, phone, status, rsvp_status')
        .eq('event_id', EVENT_ID)
        .eq('status', 'failed');

    if (err1) {
        console.error("Error fetching failed guests:", err1);
        return;
    }

    // 2. Get failed messages from whatsapp_messages
    const { data: failedMessages, error: err2 } = await supabase
        .from('whatsapp_messages')
        .select('*, guests(name, phone)')
        .eq('event_id', EVENT_ID)
        .eq('status', 'failed');

    if (err2) {
        console.error("Error fetching failed messages:", err2);
        return;
    }

    console.log("\n=============================================");
    console.log("📊 SULTAN & WIJDAN EVENT FAILURES AUDIT");
    console.log("=============================================");
    console.log(`Total Guests Marked as Failed in Guests Table: ${failedGuests.length}`);
    console.log(`Total Messages Logged as Failed: ${failedMessages.length}`);
    console.log("---------------------------------------------");

    if (failedMessages.length === 0) {
        console.log("No specific message errors logged in whatsapp_messages.");
        console.log("Let's check if there are guests with failed status but no logged messages.");
    } else {
        console.log("Detailed Message Failures:");
        failedMessages.forEach((m, idx) => {
            console.log(`[${idx + 1}] Guest: ${m.guests?.name || 'Unknown'} (${m.phone})`);
            console.log(`    Phase: ${m.message_phase || 'unknown'}`);
            console.log(`    Error Message: ${m.error_message}`);
            console.log(`    Created At: ${m.created_at}`);
            console.log("---------------------------------------------");
        });
    }

    // Identify guests marked as failed in guests table
    if (failedGuests.length > 0) {
        console.log("\nGuests Marked 'failed' in guests table:");
        for (const g of failedGuests) {
            // Find if they have any messages (success or failure)
            const { data: msgs } = await supabase
                .from('whatsapp_messages')
                .select('*')
                .eq('guest_id', g.id)
                .order('created_at', { ascending: false });

            console.log(`- Guest: ${g.name} (${g.phone})`);
            console.log(`  RSVP Status: ${g.rsvp_status}`);
            console.log(`  Messages count: ${msgs?.length || 0}`);
            msgs?.forEach((m, i) => {
                console.log(`    [Msg ${i+1}] Phase: ${m.message_phase} | Status: ${m.status} | Delivery: ${m.delivery_status} | Error: ${m.error_message}`);
            });
            console.log("---------------------------------------------");
        }
    }
}

checkEventFailures();
