import fetch from 'node-fetch';

async function sendQRTest() {
    const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1';
    const guestId = '6e90b323-6bc5-4f80-9117-2ab727f20772'; // Ahmed
    const apiUrl = 'https://lony-invite.netlify.app/api/send-campaign';

    console.log(`🚀 Sending QR Card Test for Ahmed...`);

    const payload = {
        guestIds: [guestId],
        eventId: eventId,
        campaignType: 'qr_code'
    };

    try {
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log(`Status: ${res.status}`);
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

sendQRTest();
