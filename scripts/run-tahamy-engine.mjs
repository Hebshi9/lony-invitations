import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { URL } from 'url';
global.URL = URL;
dotenv.config({ path: '/var/www/tahamy-engine/.env' });

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const META_ACCESS_TOKEN = 'EAAV4hiaLibsBRrouDUKEcJYy8xhOLxI5YZA8WaQHZBHYFOZAJuuowyhWJm4mzRFPFR1F4byHCVC2pRXMdOj4ANNIY5NXwAiNHkAhpVDtUhTZCbU1JAwkwOEbMNb9xjWroKeKnT55coZCAhyGc6uvt2VzP0wYKGbMy5wxz1cXxzvoDzPZBAsbVlsoc9RAQaJnnxXwZDZD';
const META_PHONE_NUMBER_ID = '1031606736708015';
const META_VERSION = 'v21.0';

const EVENT_ID = 'e5c16571-e50c-4ff3-ab76-259813717c62'; // Tahamy Event

async function sendMetaMessage(payload) {
    const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${META_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Meta API Error');
    return data;
}

async function sendBridge(guest) {
    console.log(`\n🌉 Sending Bridge directly to ${guest.name} (${guest.phone})...`);
    
    // Fetch event details to get groom name
    const { data: event } = await supabase.from('events').select('*').eq('id', EVENT_ID).single();
    const groomName = event?.groom_name || event?.settings?.groom_name || 'العريس';
    const brideName = event?.bride_name || event?.settings?.bride_name || 'العروس';
    const eventDate = event?.date || event?.event_time || 'قريباً';
    const eventLocation = event?.location || event?.location_name || 'الموقع';

    // 1. Stash the Marketing Payload (Apology Acceptance)
    const marketingPayload = {
        messaging_product: 'whatsapp',
        to: guest.phone,
        type: 'template',
        template: {
            name: 'get_update',
            language: { code: 'ar' },
            components: [
                { type: 'header', parameters: [{ type: 'image', image: { link: event?.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png' } }] },
                { type: 'body', parameters: [
                    { type: 'text', parameter_name: 'guest_name', text: String(guest.name || 'ضيفنا').trim() },
                    { type: 'text', parameter_name: 'groom_name', text: groomName },
                    { type: 'text', parameter_name: 'bride_name', text: brideName },
                    { type: 'text', parameter_name: 'event_date', text: eventDate },
                    { type: 'text', parameter_name: 'event_location', text: eventLocation }
                ]},
                { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: encodeURIComponent(event?.location_maps_url || eventLocation) }] }
            ]
        }
    };

    await supabase.from('guests').update({ 
        status: 'bridging', 
        pending_marketing_data: marketingPayload 
    }).eq('id', guest.id);

    // 2. Send the actual Bridge
    const bridgePayload = {
        messaging_product: 'whatsapp',
        to: guest.phone,
        type: 'template',
        template: {
            name: 'lony_invite_bridge',
            language: { code: 'ar' },
            components: [
                { 
                    type: 'body', 
                    parameters: [
                        { type: 'text', parameter_name: 'guest_name', text: String(guest.name || 'ضيفنا').trim() }, 
                        { type: 'text', parameter_name: 'sender_name', text: groomName }
                    ] 
                },
                {
                    type: 'button',
                    sub_type: 'quick_reply',
                    index: 0,
                    parameters: [
                        { type: 'payload', payload: 'BRIDGE_OK' }
                    ]
                }
            ]
        }
    };

    try {
        const res = await sendMetaMessage(bridgePayload);
        await supabase.from('whatsapp_messages').insert([{
            guest_id: guest.id,
            event_id: EVENT_ID,
            phone: guest.phone,
            evolution_message_id: res.messages[0].id,
            message_phase: 'bridge',
            message_text: 'رسالة جسر العبور',
            status: 'sent',
            delivery_status: 'sent'
        }]);
        console.log(`✅ Bridge sent successfully to ${guest.name}. Marketing payload stashed.`);
    } catch (e) {
        console.log(`❌ Bridge failed for ${guest.name}:`, e.message);
    }
}

async function processFailedBridges() {
    const { data: guests } = await supabase.from('guests')
        .select('*')
        .eq('event_id', EVENT_ID)
        .eq('status', 'bridge_failed');

    for (const guest of guests || []) {
        console.log(`\n🚀 Netlify failed to send Invitation to ${guest.name}. Catching it locally...`);
        if (guest.pending_marketing_data) {
            const payload = { ...guest.pending_marketing_data, to: guest.phone };
            try {
                const data = await sendMetaMessage(payload);
                await supabase.from('guests').update({ status: 'sent', pending_marketing_data: null }).eq('id', guest.id);
                await supabase.from('whatsapp_messages').insert([{
                    guest_id: guest.id,
                    event_id: EVENT_ID,
                    phone: guest.phone,
                    evolution_message_id: data.messages[0].id,
                    message_phase: 'invitation',
                    message_text: 'دعوة رسمية - محرك محلي احتياطي',
                    status: 'sent',
                    delivery_status: 'sent'
                }]);
                console.log(`✅ Invitation sent to ${guest.name}`);
            } catch (e) {
                console.log(`❌ Failed to send invitation:`, e.message);
            }
        }
    }
}

async function processPendingCards() {
    const { data: guests } = await supabase.from('guests')
        .select('id, name, phone, rsvp_status, card_image_url')
        .eq('event_id', EVENT_ID)
        .eq('rsvp_status', 'confirmed');

    for (const guest of guests || []) {
        const { data: msgs } = await supabase.from('whatsapp_messages')
            .select('id')
            .eq('guest_id', guest.id)
            .eq('message_phase', 'qr_code');

        if (!msgs || msgs.length === 0) {
            console.log(`\n🎫 Netlify failed to send Card to ${guest.name}. Catching it locally...`);
            const fallback = `https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/${EVENT_ID}/mock.jpg`;
            const cardUrl = guest.card_image_url || fallback;
            
            const payload = {
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: guest.phone,
                type: "image",
                image: { link: cardUrl, caption: `أهلاً وسهلاً بك يا ${guest.name}! 🎉\nتفضل كرت الدخول الشخصي الخاص بك 👇` }
            };

            try {
                const data = await sendMetaMessage(payload);
                await supabase.from('whatsapp_messages').insert([{
                    guest_id: guest.id,
                    event_id: EVENT_ID,
                    phone: guest.phone,
                    evolution_message_id: data.messages[0].id,
                    message_phase: 'qr_code',
                    message_text: `Auto-QR Response`,
                    image_url: cardUrl,
                    status: 'sent',
                    delivery_status: 'sent'
                }]);
                console.log(`✅ Card sent to ${guest.name}`);
            } catch (e) {
                console.log(`❌ Failed to send card:`, e.message);
            }
        }
    }
}

async function startEngine() {
    console.log('====================================================');
    console.log('🚂 بدء محرك الإرسال المحلي لحدث الطحامي (الالتفاف على Netlify)');
    console.log('سيتم التقاط ردود الضيوف (التي تفشل في Netlify) وإرسال الرسائل تلقائياً كل 5 ثواني...');
    console.log('====================================================');

    // Production mode - no reset

    // 1. Send bridge to idle guests
    const { data: idleGuests } = await supabase.from('guests')
        .select('*')
        .eq('event_id', EVENT_ID)
        .eq('status', 'idle');
    
    if (idleGuests && idleGuests.length > 0) {
        console.log(`Found ${idleGuests.length} idle guests. Sending bridges...`);
        for (const guest of idleGuests) {
            await sendBridge(guest);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // 2. Loop continuously to fix Netlify failures
    setInterval(async () => {
        process.stdout.write('.');
        
        // Continually check for new idle guests added from frontend
        const { data: idleGuests } = await supabase.from('guests')
            .select('*')
            .eq('event_id', EVENT_ID)
            .eq('status', 'idle');
        
        if (idleGuests && idleGuests.length > 0) {
            console.log(`\nFound ${idleGuests.length} new idle guests. Sending bridges...`);
            for (const guest of idleGuests) {
                await sendBridge(guest);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        await processFailedBridges();
        await processPendingCards();
    }, 5000);
}

startEngine();
