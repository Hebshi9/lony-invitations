import fetch from 'node-fetch';

async function runLiveTest() {
    const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1';
    const phone = '966503678789';
    const apiUrl = 'https://lony-invite.netlify.app/api/send-campaign';

    console.log(`🚀 Starting Live Production Test...`);
    console.log(`Target Phone: ${phone}`);
    console.log(`Event ID: ${eventId}`);

    // Note: We need a guest ID. I'll use the one I found in the cleanup script earlier
    // which was '6e90b323-6bc5-4f80-9117-2ab727f20772' for this phone.
    
    const payload = {
        guestIds: ['6e90b323-6bc5-4f80-9117-2ab727f20772'],
        eventId: eventId,
        campaignType: 'invite'
    };

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log(`\n--- SERVER RESPONSE ---`);
        console.log(`Status: ${res.status}`);
        console.log(JSON.stringify(data, null, 2));
        
        if (data.success) {
            console.log(`\n✅ TEST COMMAND EXECUTED SUCCESSFULLY.`);
            console.log(`Check your WhatsApp now!`);
        } else {
            console.log(`\n❌ TEST FAILED: ${data.error}`);
        }
    } catch (e) {
        console.error(`\n🚨 FATAL ERROR: ${e.message}`);
    }
}

runLiveTest();
