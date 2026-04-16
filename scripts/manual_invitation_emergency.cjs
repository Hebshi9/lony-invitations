require('dotenv').config();

const ev = {
    groom: 'خالد',
    bride: 'رغد',
    date: '2026-04-18',
    loc: 'فندق بيوت مكين قاعة الاوركيد',
    img: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/0.4889457720281837.jpg'
};

const guests = [
    {n: 'انتصار القديمي', p: '966535520888'},
    {n: 'رغد العروسه', p: '966557850779'}
];

async function run() {
    console.log('🚀 EMERGENCY SEND: Manual Invitation Dispatch...');
    for (const g of guests) {
        console.log(`➡️ Sending Template to ${g.n} (${g.p})...`);
        
        const payload = {
            messaging_product: 'whatsapp',
            to: g.p,
            type: 'template',
            template: {
                name: 'lony',
                language: { code: 'ar' },
                components: [
                    {
                        type: 'header',
                        parameters: [{ type: 'image', image: { link: ev.img } }]
                    },
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', parameter_name: 'guest_name', text: g.n },
                            { type: 'text', parameter_name: 'groom_name', text: ev.groom },
                            { type: 'text', parameter_name: 'bride_name', text: ev.bride },
                            { type: 'text', parameter_name: 'event_date', text: ev.date },
                            { type: 'text', parameter_name: 'event_location', text: ev.loc }
                        ]
                    }
                ]
            }
        };

        const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const resp = await res.json();
        if (res.ok) {
            console.log(`✅ Success for ${g.n}. Message ID: ${resp.messages[0].id}`);
        } else {
            console.error(`❌ Error for ${g.n}:`, JSON.stringify(resp));
        }
    }
}

run();
