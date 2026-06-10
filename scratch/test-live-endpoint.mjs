import fetch from 'node-fetch';

async function run() {
    const payload = {
        guestIds: ["d58eac57-066c-42d2-8a57-6e39709c0659"], // valid guest ID
        eventId: "a5931bed-8ae0-4881-9a6d-f55964859426", // correct event ID
        campaignType: "invitation",
        testPhone: "966503678789"
    };

    console.log("🚀 Calling live Netlify function /api/send-batch-v2 with correct Event ID...");
    try {
        const res = await fetch("https://lonyinvite.netlify.app/.netlify/functions/send-batch-v2", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        console.log(`Status Code: ${res.status}`);
        const text = await res.text();
        console.log("Response text:");
        console.log(text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

run();
