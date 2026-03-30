import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateGuestView() {
    console.log("Creating test event and guest...");
    
    // 1. Create Event
    const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
            name: "Test PIN Event " + Date.now(),
            date: "2026-04-01",
            token: "evt-" + Date.now(),
            host_pin: "1234",
            features: { enable_host_pin: true }
        })
        .select()
        .single();
        
    if (eventError) return console.error("Event error:", eventError);
    
    // 2. Create Guest
    const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({
            event_id: event.id,
            name: "Test Guest",
            phone: "+966500000000",
            companions_count: 2, // 3 total allowed
            qr_token: "test-token-" + Date.now()
        })
        .select()
        .single();
        
    if (guestError) return console.error("Guest error:", guestError);
    
    console.log(`Created guest ${guest.id} with 2 companions (3 total allowed).`);
    
    // 3. Simulate GuestView performCheckIn
    console.log("Simulating PIN entry and performCheckIn()...");
    const now = new Date().toISOString();

    const { error: scanError } = await supabase
        .from('scans')
        .insert({
            guest_id: guest.id,
            event_id: event.id,
            scanned_at: now
        });
        
    if (scanError) return console.error("Scan insert error:", scanError);

    const { data: currentGuest } = await supabase
        .from('guests')
        .select('companions_attended, attended_at')
        .eq('id', guest.id)
        .single();

    const newCompanionsAttended = (currentGuest?.companions_attended || 0) + 1;

    await supabase
        .from('guests')
        .update({
            attended: true,
            attended_at: currentGuest?.attended_at || now,
            companions_attended: newCompanionsAttended
        })
        .eq('id', guest.id);
        
    // 4. Fetch final state
    const { data: finalScans } = await supabase
        .from('scans')
        .select('*')
        .eq('guest_id', guest.id);
        
    console.log("Final Scans Count:", finalScans.length);
    console.log("If Final Scans is 1, then the logic strictly consumes exactly 1 ticket.");
}

simulateGuestView();
