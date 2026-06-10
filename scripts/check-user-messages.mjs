import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const PHONE_TO_CHECK = '966503678789';
const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function checkGuest() {
    console.log(`Checking status for phone number: ${PHONE_TO_CHECK}...`);

    // 1. Get Guest Info
    const { data: guests, error: err1 } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', EVENT_ID)
        .or(`phone.eq.${PHONE_TO_CHECK},phone.eq.0503678789,phone.eq.503678789`);

    if (err1) {
        console.error("Error fetching guest:", err1);
        return;
    }

    if (!guests || guests.length === 0) {
        console.log("❌ No guest found with this phone number in event: " + EVENT_ID);
        return;
    }

    const guest = guests[0];
    console.log("Guest Found:", {
        id: guest.id,
        name: guest.name,
        phone: guest.phone,
        status: guest.status,
        rsvp_status: guest.rsvp_status,
        updated_at: guest.updated_at
    });

    // 2. Get Messages Log
    const { data: messages, error: err2 } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('guest_id', guest.id)
        .order('created_at', { ascending: false });

    if (err2) {
        console.error("Error fetching messages:", err2);
        return;
    }

    console.log(`\nMessages logged for ${guest.name} (${messages.length} total):`);
    messages.forEach((m, idx) => {
        console.log(`[${idx + 1}] ID: ${m.id}`);
        console.log(`    Phase: ${m.message_phase}`);
        console.log(`    Status: ${m.status}`);
        console.log(`    Delivery Status: ${m.delivery_status}`);
        console.log(`    Error Message: ${m.error_message}`);
        console.log(`    Created At: ${m.created_at}`);
        console.log("-----------------------------------");
    });
}

checkGuest();
