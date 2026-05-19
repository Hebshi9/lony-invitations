import fetch from 'node-fetch';

async function mockWebhookCall() {
    const webhookUrl = 'https://lony-invite.netlify.app/api/meta-webhook';
    const phone = '966503678789';
    
    console.log(`🚀 Simulating 'Confirm' click for ${phone}...`);
    
    const payload = {
      "entry": [
        {
          "id": "3277627339072448",
          "changes": [
            {
              "field": "messages",
              "value": {
                "contacts": [{ "wa_id": phone, "profile": { "name": "Ahmed" } }],
                "messages": [
                  {
                    "id": "wamid.MOCK_TEST_ID_" + Date.now(),
                    "from": phone,
                    "type": "button",
                    "button": { "text": "تأكيد الحضور", "payload": "تأكيد الحضور" },
                    "timestamp": Math.floor(Date.now() / 1000)
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

mockWebhookCall();
