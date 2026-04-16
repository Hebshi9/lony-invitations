require('dotenv').config();

const guests = [
    {n:'غيداء', p:'966505107844', u:'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/cc45c08a-8709-4841-8d79-03ce98dd5edd/ee60b649-b983-455d-bd53-9436da2ff54e.jpg'},
    {n:'أشواق العنزي', p:'966506757562', u:'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/cc45c08a-8709-4841-8d79-03ce98dd5edd/4bee0f39-b9e4-480c-9df7-955d9cc406b4.jpg'},
    {n:'ساره الجفري', p:'966507240097', u:'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/cc45c08a-8709-4841-8d79-03ce98dd5edd/43584b6e-af82-4114-94f0-c3cb7e20dab7.jpg'},
    {n:'حمد', p:'966503678789', u:'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/cc45c08a-8709-4841-8d79-03ce98dd5edd/c697445a-8fa4-47fb-b3a5-f7d2622d2f1c.jpg'},
    {n:'شوق الدوسري', p:'966555572334', u:'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/cc45c08a-8709-4841-8d79-03ce98dd5edd/70d091aa-65af-4296-848d-3ca338cf3a57.jpg'},
    {n:'مرام عبدالمحسن', p:'966536933199', u:'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/cc45c08a-8709-4841-8d79-03ce98dd5edd/738f45fb-2d15-481e-ae84-3f510ea26c23.jpg'},
    {n:'رهف الأحمري', p:'966506796154', u:'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/cc45c08a-8709-4841-8d79-03ce98dd5edd/d88cde71-ff67-4fee-ac54-67ace9d17bf3.jpg'}
];

async function run() {
    console.log('🚀 DEDICATED SCRIPT: Sending QR Cards manually...');
    for (const g of guests) {
        console.log(`➡️ Sending Card to ${g.n} (${g.p})...`);
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: g.p,
            type: 'image',
            image: { 
                link: g.u, 
                caption: `أهلاً بك يا ${g.n} 🌺\n\nتفضل بطاقة الدخول الخاصة بك. بانتظارك!` 
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
            console.log(`✅ Success for ${g.n}`);
        } else {
            console.error(`❌ Error for ${g.n}:`, JSON.stringify(resp));
        }
    }
}

run();
