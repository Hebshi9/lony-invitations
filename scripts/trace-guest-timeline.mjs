import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const GUEST_ID = 'da753ec3-9a47-4bee-be3e-2e8271939d85';

async function traceTimeline() {
    console.log(`Tracing timeline for Guest ID: ${GUEST_ID}...`);
    
    const { data: guest } = await supabase.from('guests').select('*').eq('id', GUEST_ID).single();
    const { data: msgs } = await supabase.from('whatsapp_messages').select('*').eq('guest_id', GUEST_ID);

    console.log("\n--- Guest Record ---");
    console.log(`Created At: ${guest.created_at}`);
    console.log(`Updated At: ${guest.updated_at}`);
    console.log(`Status: ${guest.status}`);
    console.log(`RSVP Status: ${guest.rsvp_status}`);

    console.log("\n--- WhatsApp Messages ---");
    msgs.forEach((m, idx) => {
        console.log(`[Msg ${idx+1}] ID: ${m.id}`);
        console.log(`  Created At: ${m.created_at}`);
        console.log(`  Updated At: ${m.updated_at}`);
        console.log(`  Phase: ${m.message_phase}`);
        console.log(`  Status: ${m.status}`);
        console.log(`  Delivery Status: ${m.delivery_status}`);
        console.log(`  Error Message: ${m.error_message}`);
        console.log(`  Delivered At: ${m.delivered_at}`);
        console.log(`  Read At: ${m.read_at}`);
    });
}

traceTimeline();
