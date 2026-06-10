import fetch from 'node-fetch';

async function run() {
    const payload = {
        guestIds: ["bb181d71-8460-47b5-9c9c-ddb72e5dee97"], // نادية الجلعود
        eventId: "a5931bed-8ae0-4881-9a6d-f55964859426",
        campaignType: "invite",
        testPhone: "966503678789" // أرسلها على رقمك أنت للاختبار
    };

    console.log("🚀 Testing Netlify LIVE send-campaign for نادية → رقمك ...");
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
