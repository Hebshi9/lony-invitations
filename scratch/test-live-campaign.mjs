import fetch from 'node-fetch';

async function run() {
    const payload = {
        guestIds: ["5315b960-40a3-46e2-896c-58569abdb17d"],
        eventId: "a5931bed-8ae0-4881-9a6d-f55964859426",
        campaignType: "invite"
    };

    console.log("🚀 Testing Netlify LIVE /api/send-campaign ...");
    try {
        const res = await fetch("https://lonyinvite.netlify.app/.netlify/functions/send-campaign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        console.log(`Status Code: ${res.status}`);
        const text = await res.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

run();
