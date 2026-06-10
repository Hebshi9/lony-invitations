
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

export default async function handler(req) {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const { eventId } = await req.json();

        // 1. Fetch Event and Client/Owner Phone
        const eventRes = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=*`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const event = (await eventRes.json())[0];
        if (!event) throw new Error('Event not found');

        // Priority: owner_phone -> client_phone
        let rawPhone = event.owner_phone || event.client_phone;
        if (!rawPhone) throw new Error('No contact phone found for reports');

        // 2. Fetch Stats & Details
        const statsRes = await fetch(`${SUPABASE_URL}/rest/v1/guests?event_id=eq.${eventId}&select=name,phone,rsvp_status,checked_in,status`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const guests = await statsRes.json();

        const total = guests.length;
        const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;
        const declinedList = guests.filter(g => g.rsvp_status === 'declined');
        const declinedNames = declinedList.map(g => `${g.name} (${g.phone})`).join(', ');
        const pending = guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length;
        const failed = guests.filter(g => g.status === 'failed').length;
        const attended = guests.filter(g => g.checked_in).length;

        // 3. Generate AI Summary via Gemini
        const dashboardLink = `https://lonyinvite.netlify.app/host/${event.id}`;
        const prompt = `
        أنت مساعد ذكي لمنصة لوني لدعوات الزفاف.
        قم بصياغة تقرير مفصل ومبهج لصاحب المناسبة بناءً على البيانات التالية:
        
        - اسم المناسبة: ${event.name}
        - إجمالي الضيوف: ${total}
        - تم تأكيد الحضور: ${confirmed} ✅
        - اعتذروا عن الحضور: ${declinedList.length} ❌
        - بانتظار الرد (لم يقرأوا/لم يتفاعلوا): ${pending} ⏳
        - فشل إرسال الدعوات لهم (أرقام خاطئة أو مشكلة تقنية): ${failed} ⚠️
        - ضيوف دخلوا القاعة فعلياً: ${attended} 🎫

        رابط لوحة متابعة النتائج المباشرة: ${dashboardLink}

        قائمة المعتذرين (للإحاطة):
        ${declinedNames || 'لا يوجد معتذرين حتى الآن'}

        الرسالة يجب أن تكون باللغة العربية، ودودة جداً، وبأسلوب احترافي "لوني". 
        وزع الرموز التعبيرية (Emojis) بشكل جميل.
        أكد في نهاية الرسالة أن الرابط المرفق يتيح متابعة الإحصائيات لحظة بلحظة.
        التقرير يجب أن يكون جاهزاً للإرسال لصاحب المناسبة ليعرف من هم المعتذرين ليتمكن من استبدالهم إذا أراد.
        لا تضف أي نص مقدمات، فقط التقرير المباشر.
        `;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const geminiData = await geminiRes.json();
        
        if (!geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error(`Gemini failed: ${JSON.stringify(geminiData)}`);
        }
        
        const aiSummary = geminiData.candidates[0].content.parts[0].text.trim();

        // 4. Send Message to Owner via Meta
        let ownerPhone = (event.owner_phone || event.client_phone || '').replace(/\D/g, '');
        if (ownerPhone.startsWith('05')) ownerPhone = '966' + ownerPhone.substring(1);
        else if (ownerPhone.startsWith('5') && ownerPhone.length === 9) ownerPhone = '966' + ownerPhone;
        else if (ownerPhone.length === 9) ownerPhone = '966' + ownerPhone;

        if (!ownerPhone) throw new Error('رقم صاحب المناسبة غير متوفر للإرسال');

        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: ownerPhone,
                type: 'text',
                text: { body: aiSummary }
            })
        });

        return new Response(JSON.stringify({ success: true, summary: aiSummary }), { status: 200 });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
