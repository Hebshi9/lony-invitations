
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

        // 2. Fetch Stats
        const statsRes = await fetch(`${SUPABASE_URL}/rest/v1/guests?event_id=eq.${eventId}&select=rsvp_status,checked_in`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const guests = await statsRes.json();

        const total = guests.length;
        const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;
        const declined = guests.filter(g => g.rsvp_status === 'declined').length;
        const pending = guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending').length;
        const attended = guests.filter(g => g.checked_in).length;

        // 3. Generate AI Summary via Gemini
        const prompt = `
        أنت مساعد ذكي لمنصة لوني لدعوات الزفاف.
        قم بصياغة تقرير مختصر ومبهج لصاحب المناسبة بناءً على البيانات التالية:
        - اسم المناسبة: ${event.name}
        - إجمالي الضيوف: ${total}
        - المؤكدين: ${confirmed}
        - المعتذرين: ${declined}
        - لم يردوا بعد: ${pending}
        - دخلوا القاعة: ${attended}

        الرسالة يجب أن تكون باللغة العربية، ودودة، وبأسلوب احترافي. 
        استخدم الرموز التعبيرية (Emojis).
        لا تضف أي نص مقدمات، فقط التقرير المباشر.
        `;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const geminiData = await geminiRes.json();
        const aiSummary = geminiData.candidates[0].content.parts[0].text.trim();

        // 4. Send Message to Owner via Meta
        let ownerPhone = event.client_phone.replace(/\D/g, '');
        if (ownerPhone.startsWith('05')) ownerPhone = '966' + ownerPhone.substring(1);

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
