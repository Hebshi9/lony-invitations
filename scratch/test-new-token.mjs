import fetch from 'node-fetch';

async function run() {
    const guestPhone = '966503678789'; // Huda's number
    const PHONE_ID = '1031606736708015';
    const NEW_TOKEN = 'EAAV4hiaLibsBRn4mCPQ8sxJEyY5rXUaQ8xJhDuyBxVwkTnEx1ZArMK2YTZBuNROKsy0NBNUUUZBX77WrZAFfYMdMItbY7y5ESIwtS8KVwkpuhIq727wfmhC5biAWVuh6tbDkZAbNhFAc0yq0jZCCNebdZACCkZCOC76BzJZCa4Dwr4F7e0hIHZAI9rjdcPpVGJZAZBFEYrUPAYM2y5wDAk2REfWOgeEKrH6KvBQmufpbE6D36MOlFDG1TH3ZBWGB0PxyoCPuBr7ijZBuvFMOEiGOhEUsJaYITD';
    const guestId = '5315b960-40a3-46e2-896c-58569abdb17d'; // Huda's guest ID

    console.log("🚀 Testing the new token with corrected parameters and button...");

    const payload = {
        messaging_product: 'whatsapp',
        to: guestPhone,
        type: 'template',
        template: {
            name: 'get_update', 
            language: { code: 'ar' },
            components: [
                {
                    type: 'header',
                    parameters: [
                        {
                            type: 'image',
                            image: { link: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/0.5058560900263716.jpg' }
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', parameter_name: 'guest_name', text: 'هدى' },
                        { type: 'text', parameter_name: 'groom_name', text: 'نادر' },
                        { type: 'text', parameter_name: 'bride_name', text: 'عواطف' },
                        { type: 'text', parameter_name: 'event_date', text: 'اليوم' },
                        { type: 'text', parameter_name: 'event_location', text: 'قاعة الاحتفالات' }
                    ]
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: '2',
                    parameters: [
                        {
                            type: 'text',
                            text: guestId
                        }
                    ]
                }
            ]
        }
    };

    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NEW_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log(`Status Code: ${res.status}`);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

run();
