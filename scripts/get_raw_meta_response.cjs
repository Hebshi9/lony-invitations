require('dotenv').config();

async function getRawResponses() {
    const targets = [
        { name: 'رغد', phone: '966557850779' },
        { name: 'انتصار', phone: '966535520888' }
    ];

    console.log('🚀 Pinging Meta API for Raw Status Details...');

    for (const target of targets) {
        const payload = {
            messaging_product: 'whatsapp',
            to: target.phone,
            type: 'template',
            template: {
                name: 'lony',
                language: { code: 'ar' },
                components: [
                    {
                        type: 'header',
                        parameters: [{ type: 'image', image: { link: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/0.4889457720281837.jpg' } }]
                    },
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: target.name },
                            { type: 'text', text: 'خالد' },
                            { type: 'text', text: 'رغد' },
                            { type: 'text', text: '2026-04-18' },
                            { type: 'text', text: 'فندق بيوت مكين القصر' }
                        ]
                    }
                ]
            }
        };

        try {
            const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PHONE_NUMBER_ID}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.META_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const resp = await res.json();
            
            console.log(`\n========================================`);
            console.log(`📡 TARGET: ${target.name} (${target.phone})`);
            console.log(`📊 HTTP STATUS: ${res.status}`);
            console.log(`📦 RAW JSON:`);
            console.log(JSON.stringify(resp, null, 2));
            console.log(`========================================\n`);
        } catch (err) {
            console.error(`❌ Connection Error for ${target.name}:`, err.message);
        }
    }
}

getRawResponses();
