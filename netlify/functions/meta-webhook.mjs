
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_VERSION = 'v21.0';
const VERIFY_TOKEN = 'lony_invite_v1_secure';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req) {
  // 1. Meta Validation (GET)
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    } catch (e) {
      return new Response('Error', { status: 500 });
    }
  }

  // 2. RSVP Processing (POST)
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0];
        const value = change?.value;
        const message = value?.messages?.[0];

        if (message) {
          const from = message.from;
          const buttonText = message.button?.text || '';
          const payload = message.button?.payload || '';
          const bodyText = message.text?.body || '';
          
          const combinedContent = `${buttonText} ${payload} ${bodyText}`.toUpperCase();

          console.log(`[Meta Webhook] From: ${from} | Raw Content: "${combinedContent}"`);

          const isConfirm = combinedContent.includes('CONFIRM') || combinedContent.includes('تأكيد') || combinedContent.includes('حضور');
          const isDecline = combinedContent.includes('DECLINE') || combinedContent.includes('اعتذار');

          if (isConfirm) {
            await handleRSVP(from, 'confirmed');
          } else if (isDecline) {
            await handleRSVP(from, 'declined');
          }
        }
      }

      return new Response('OK', { status: 200 });
    } catch (err) {
      console.error('[Meta Webhook] Error:', err.message);
      return new Response('Server Error', { status: 500 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}

async function handleRSVP(phone, status) {
  // Dynamic import to prevent bundling crashes on Netlify
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const digits = phone.replace(/\D/g, '');
  const searchPart = digits.slice(-9);

  const { data: guests, error } = await supabase
    .from('guests')
    .select('*, events(name)')
    .or(`phone.ilike.%${searchPart}%,phone.ilike.%${digits}%`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !guests?.length) return;

  const guest = guests[0];
  const eventName = guest.events?.name || 'الحفل';

  // Update Status
  await supabase
    .from('guests')
    .update({ 
      rsvp_status: status, 
      rsvp_at: new Date().toISOString()
    })
    .eq('id', guest.id);

  // Send Response
  if (status === 'confirmed') {
    await sendMetaText(phone, `أهلاً وسهلاً بك يا ${guest.name}! 🎉\nيسعدنا تأكيد حضورك في ${eventName}. كرتك الشخصي مرفق بالأسفل 👇`);
    if (guest.card_image_url) {
      await sendMetaImage(phone, guest.card_image_url, `كرت دخول الحفل باسم: ${guest.name}`);
    }
  } else {
    await sendMetaText(phone, `يعزّ علينا عدم حضورك يا ${guest.name}.. نسأل الله أن يجمعنا بك في أفراح قادمة 💐`);
  }
}

async function sendMetaPost(payload) {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  return await res.json();
}

async function sendMetaText(to, text) {
  return sendMetaPost({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });
}

async function sendMetaImage(to, imageUrl, caption) {
  return sendMetaPost({
    messaging_product: 'whatsapp',
    to,
    type: 'image',
    image: { link: imageUrl, caption },
  });
}
