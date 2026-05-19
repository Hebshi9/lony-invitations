import fetch from 'node-fetch';

const eventId = "0900ecaf-3d22-4f3b-bc01-9df1ef75f9f7";
const realGuestIds = [
    "3cb7329b-47e7-42c6-b89b-afecf7438ddf", // Hamad
    "f382d587-1be3-447e-8787-95e930bb0e36"  // Sara Al-Jiffri
];

async function triggerFinalBulk() {
    console.log('🚀 Triggering FINAL BULK for Jiffri Wedding...');
    const response = await fetch('http://localhost:3011/api/send-campaign-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            eventId: eventId,
            guestIds: realGuestIds,
            campaignType: 'invitation'
        })
    });

    const body = await response.json();
    console.log('STATUS:', response.status);
    console.log('BODY:', JSON.stringify(body, null, 2));
}

triggerFinalBulk();
