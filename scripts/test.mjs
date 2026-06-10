import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const META_ACCESS_TOKEN = 'EAAV4hiaLibsBRrouDUKEcJYy8xhOLxI5YZA8WaQHZBHYFOZAJuuowyhWJm4mzRFPFR1F4byHCVC2pRXMdOj4ANNIY5NXwAiNHkAhpVDtUhTZCbU1JAwkwOEbMNb9xjWroKeKnT55coZCAhyGc6uvt2VzP0wYKGbMy5wxz1cXxzvoDzPZBAsbVlsoc9RAQaJnnxXwZDZD';

async function run() {
    console.log('Resetting Sarah...');
    const guestId = 'b6788ed5-ae00-44fe-aa96-a2414597e9f5';
    await supabase.from('guests').update({ status: 'bridging', rsvp_status: null, pending_marketing_data: null }).eq('id', guestId);
    
    const { data: event } = await supabase.from('events').select('*').eq('id', 'e5c16571-e50c-4ff3-ab76-259813717c62').single();
    
    const marketingPayload = {
        messaging_product: 'whatsapp',
        to: '966503678789',
        type: 'template',
        template: {
            name: 'get_update',
            language: { code: 'ar' },
            components: [
                { type: 'header', parameters: [{ type: 'image', image: { link: event?.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png' } }] },
                { type: 'body', parameters: [
                    { type: 'text', parameter_name: 'guest_name', text: 'سارة' },
                    { type: 'text', parameter_name: 'groom_name', text: event.groom_name },
                    { type: 'text', parameter_name: 'bride_name', text: event.bride_name || 'العروس' },
                    { type: 'text', parameter_name: 'event_date', text: event.date || event.event_time || 'قريباً' },
                    { type: 'text', parameter_name: 'event_location', text: event.location || event.location_name || 'الموقع' }
                ]},
                { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: (event.location_maps_url || 'الموقع').trim() }] }
            ]
        }
    };

    await supabase.from('guests').update({ pending_marketing_data: marketingPayload }).eq('id', guestId);

    const bridgePayload = {
        messaging_product: 'whatsapp',
        to: '966503678789',
        type: 'template',
        template: {
            name: 'lony_invite_bridge',
            language: { code: 'ar' },
            components: [
                { type: 'body', parameters: [{ type: 'text', parameter_name: 'guest_name', text: 'سارة' }, { type: 'text', parameter_name: 'sender_name', text: event.groom_name }] },
                { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'BRIDGE_OK' }] }
            ]
        }
    };

    console.log('Sending Bridge...');
    const res = await fetch(`https://graph.facebook.com/v21.0/1031606736708015/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bridgePayload)
    });
    
    console.log('Result:', await res.json());
}
run();
