import fetch from 'node-fetch';

const PORT = 8888;
const TEST_PHONE = '966503678789'; // Ahmed's phone

async function simulateBridgeClick() {
    console.log(`🚀 Simulating Meta webhook bridge button click locally on port ${PORT}...`);
    
    const webhookPayload = {
        object: "whatsapp_business_account",
        entry: [
            {
                id: "3277627339072448",
                changes: [
                    {
                        field: "messages",
                        value: {
                            messaging_product: "whatsapp",
                            metadata: {
                                display_phone_number: "966507837584",
                                phone_number_id: "1031606736708015"
                            },
                            contacts: [
                                {
                                    profile: {
                                        name: "Ahmed"
                                    },
                                    wa_id: TEST_PHONE
                                }
                            ],
                            messages: [
                                {
                                    from: TEST_PHONE,
                                    id: "wamid.HBgMOTY2NTAzNjc4Nzg5FQIAERgSRjZBNzNBRTMxQzRFMjQ2N0E1AA==",
                                    timestamp: String(Math.floor(Date.now() / 1000)),
                                    type: "button",
                                    button: {
                                        payload: "SEND_DETAILS",
                                        text: "أرسل تفاصيل الدعوة"
                                    },
                                    context: {
                                        id: "wamid.HBgMOTY2NTAzNjc4Nzg5FQIAERgSM0MwQzMxQjY0QzkwMEY4MjAyAA=="
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    };

    const webhookUrl = `http://localhost:${PORT}/.netlify/functions/meta-webhook`;

    try {
        console.log(`Sending POST request to ${webhookUrl}...`);
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(webhookPayload)
        });

        const resText = await res.text();
        console.log(`\n--- LOCAL WEBHOOK RESPONSE ---`);
        console.log(`Status Code: ${res.status}`);
        console.log(`Response Body:\n${resText}`);
    } catch (e) {
        console.error(`❌ Connection failed. Is the Netlify CLI dev server running on port ${PORT}?`, e.message);
    }
}

simulateBridgeClick();
