import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const guestId = '5315b960-40a3-46e2-896c-58569abdb17d';
    const eventId = 'a5931bed-8ae0-4881-9a6d-f55964859426';

    console.log("🔍 Fetching guest and event data...");
    const { data: guest } = await supabase.from('guests').select('*').eq('id', guestId).single();
    const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();

    if (!guest || !event) {
        console.error("❌ Guest or Event not found in DB!");
        return;
    }

    console.log(`👤 Guest: ${guest.name} (${guest.phone})`);
    console.log(`📅 Event: ${event.name}`);

    const PHONE_ID = process.env.META_PHONE_NUMBER_ID || '1031606736708015';
    const META_TOKEN = process.env.META_ACCESS_TOKEN;

    console.log(`🔑 Using Phone ID: ${PHONE_ID}`);
    console.log(`🔑 Token starting with: ${META_TOKEN?.substring(0, 15)}...`);

    const headerImage = event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png';
    const groomName = event.settings?.groom_name || 'نادر';
    const brideName = event.settings?.bride_name || 'عواطف';
    const eventDate = event.date || 'اليوم';
    const eventLocation = event.location || 'قاعة الاحتفالات';

    const payload = {
        messaging_product: 'whatsapp',
        to: guest.phone,
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
                            image: { link: headerImage }
                        }
                    ]
                },
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: guest.name || 'ضيفنا' },
                        { type: 'text', text: groomName },
                        { type: 'text', text: brideName },
                        { type: 'text', text: eventDate },
                        { type: 'text', text: eventLocation }
                    ]
                }
            ]
        }
    };

    console.log("🚀 Sending request to Meta Graph API...");
    try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${META_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log(`\nStatus Code: ${res.status}`);
        console.log("Meta API Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Fetch error:", e);
    }
}

run();
