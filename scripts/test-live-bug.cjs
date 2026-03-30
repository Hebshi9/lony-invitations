const fs = require('fs');

const API_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co/rest/v1';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';

async function apiCall(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    console.log(`📡 Fetching: ${options.method || 'GET'} ${url}`);
    const response = await fetch(url, {
        ...options,
        headers: {
            'apikey': API_KEY,
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            ...options.headers
        }
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ HTTP Error: ${response.status} - ${errText}`);
        throw new Error(`API Error: ${response.status} - ${errText}`);
    }

    if (options.method !== 'HEAD' && response.status !== 204) {
        return await response.json();
    }
    return null;
}

async function run() {
    try {
        // 1. Get an event with PIN enabled
        const events = await apiCall('/events?select=id,name,features,host_pin&limit=100');
        const pinEvent = events.find(e => e.features?.enable_host_pin && e.host_pin);
        
        if (!pinEvent) {
            console.log("No PIN events found");
            return;
        }
        console.log(`✅ Found PIN event: ${pinEvent.name} (ID: ${pinEvent.id})`);

        // 2. Create a BRAND NEW guest for this event
        const newGuestId = 'test-' + Date.now();
        const createRes = await apiCall('/guests', {
            method: 'POST',
            body: JSON.stringify({
                event_id: pinEvent.id,
                name: "Test Guest UI Bug",
                phone: "0500000000",
                companions_count: 0,
                qr_token: newGuestId
            })
        });
        
        // Fetch the newly created guest to get its UUID
        const guests = await apiCall(`/guests?qr_token=eq.${newGuestId}&limit=1`);
        const guest = guests[0];
        console.log(`✅ Created BRAND NEW guest: ${guest.name} (ID: ${guest.id})`);

        // 3. Simulate verifyPin() execution
        console.log("\n--- SIMULATING VERIFY PIN ---");
        
        // Step A: Fetch scans initially
        const initialScans = await apiCall(`/scans?guest_id=eq.${guest.id}&order=scanned_at.desc`);
        console.log("Initial scans:", initialScans.length);
        if (initialScans.length > 0) {
            console.log("PHANTOM SCAN ROW:", JSON.stringify(initialScans, null, 2));
        }
        
        const totalAllowed = 1 + (guest.companions_count || 0);
        const remaining = totalAllowed - initialScans.length;
        console.log(`Total Allowed: ${totalAllowed}, Remaining: ${remaining}`);

        if (remaining > 0) {
            console.log("\n--- performCheckIn START ---");
            try {
                // Step B: Insert scan
                const scanRes = await apiCall('/scans', {
                    method: 'POST',
                    body: JSON.stringify({
                        guest_id: guest.id,
                        event_id: pinEvent.id,
                        scanned_at: new Date().toISOString()
                    })
                });
                console.log("✅ POST /scans succeeded!", scanRes);

                // Step C: Update guest
                const currentAttended = guest.companions_attended || 0;
                const newAttendedCount = guest.attended ? currentAttended + 1 : currentAttended;
                
                try {
                    const patchRes = await apiCall(`/guests?id=eq.${guest.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            attended_at: guest.attended_at || new Date().toISOString(),
                            companions_attended: newAttendedCount,
                            scan_count: (guest.scan_count || 0) + 1
                        }),
                        headers: { 'Prefer': 'return=minimal' }
                    });
                    console.log("✅ PATCH /guests succeeded!");
                } catch (patchErr) {
                    console.log("⚠️ PATCH /guests failed! (Caught safely)", patchErr.message);
                }
            } catch (err) {
                console.log("❌ performCheckIn CRASHED at POST /scans!", err.message);
                // IF THIS CRASHES, THE UI SHOWS "خطأ في الاتصال"
            }
            console.log("--- performCheckIn END ---\n");
            
            // Step D: Fetch new scans
            try {
                const newScans = await apiCall(`/scans?guest_id=eq.${guest.id}&order=scanned_at.desc`);
                console.log("Final scans fetched:", newScans.length);
                console.log("✅ UI WOULD SHOW GREEN SUCCESS SCREEN!");
            } catch (err) {
                console.log("❌ Final GET /scans CRASHED!", err.message);
            }

        } else {
            console.log("❌ UI WOULD SHOW RED ERROR SCREEN (showAlreadyScanned)!");
        }

    } catch (e) {
        console.error("Simulation failed:", e);
    }
}

run();
