const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // 1. Create a dummy event with PIN
    const { data: event, error: eventErr } = await supabase
        .from('events')
        .insert({
            token: "test-token-" + Date.now(),
            name: "Test PIN Event " + Date.now(),
            features: { enable_host_pin: true },
            host_pin: "1234"
        })
        .select()
        .single();
    
    console.log("Created Event:", event.id);

    // 2. Create a dummy guest with 0 companions
    const { data: guest, error: guestErr } = await supabase
        .from('guests')
        .insert({
            event_id: event.id,
            name: "Dummy No Companion",
            companions_count: 0
        })
        .select()
        .single();

    console.log("Created Guest:", guest.id, "Token:", guest.qr_token);

    // SIMULATE check-in.html
    const API_URL = supabaseUrl + '/rest/v1';
    
    // Simulate init() API call
    const fetch = require('node-fetch');
    const res1 = await fetch(`${API_URL}/guests?qr_token=eq.${guest.qr_token}&select=*,events(*)`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const guests = await res1.json();
    console.log("INIT API Call:", guests.length > 0 ? "Success" : "Failed");

    // Simulate verifyPin()
    console.log("Executing verifyPin()...");
    
    // Check scans
    const res2 = await fetch(`${API_URL}/scans?guest_id=eq.${guest.id}&order=scanned_at.desc`, {
         headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const scans1 = await res2.json();
    console.log("Scans BEFORE checkin:", scans1.length);
    
    // Perform check in
    const res3 = await fetch(`${API_URL}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({ guest_id: guest.id, event_id: event.id, scanned_at: new Date().toISOString() })
    });
    console.log("Perform Checkin HTTP Status:", res3.status);

    // Refresh scans
    const res4 = await fetch(`${API_URL}/scans?guest_id=eq.${guest.id}&order=scanned_at.desc`, {
         headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    const scans2 = await res4.json();
    console.log("Scans AFTER checkin:", scans2.length);

    console.log("Checking if there was a hidden scan...");
    if (scans1.length > 0) {
        console.log("BUG: A SCAN MAGICALLY APPEARED BEFORE WE CHECKED IN!");
    } else {
        console.log("Everything is perfect. Length is exactly as expected.");
    }
}
run();
