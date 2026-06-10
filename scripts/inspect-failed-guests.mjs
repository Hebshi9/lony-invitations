import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = '049fbefa-18bd-489d-b38d-7502a186d444';

async function inspectGuests() {
    console.log("Inspecting failed guests metadata...");

    const { data: guests, error } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', EVENT_ID)
        .eq('status', 'failed');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`\nFailed guests detail count: ${guests.length}`);
    guests.forEach((g, idx) => {
        console.log(`[${idx+1}] Name: ${g.name} (${g.phone})`);
        console.log(`    Status: ${g.status}`);
        console.log(`    RSVP Status: ${g.rsvp_status}`);
        console.log(`    Updated At: ${g.updated_at}`);
        console.log(`    Custom Fields:`, JSON.stringify(g.custom_fields, null, 2));
        console.log(`    Pending Marketing Data:`, g.pending_marketing_data ? "Present" : "None");
        console.log("-------------------------------------------------");
    });
}

inspectGuests();
