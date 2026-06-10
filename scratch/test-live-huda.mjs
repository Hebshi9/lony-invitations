import fetch from 'node-fetch';

async function run() {
    const payload = {
        guestIds: ["5315b960-40a3-46e2-896c-58569abdb17d"], // Huda's guest ID
        eventId: "a5931bed-8ae0-4881-9a6d-f55964859426", // Event ID for Nader & Awatef
        campaignType: "invitation"
    };

    console.log("🚀 Testing live Netlify endpoint /api/send-batch-v2 for guest Huda...");
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
        console.log("Response JSON:");
        console.log(text);
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

run();
