import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';
const META_TOKEN = process.env.META_ACCESS_TOKEN || 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';
const PHONE_ID = process.env.META_PHONE_NUMBER_ID || '1031606736708015';

const supabase = createClient(supabaseUrl, supabaseKey);
const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
const TARGET_PHONE = '966503678789';

async function testSingleBridge() {
    console.log(`🔍 [Test] Locating guest with phone ${TARGET_PHONE} in event ${EVENT_ID}...`);
    
    // Fetch guest
    const { data: guests, error: gErr } = await supabase
        .from('guests')
        .select('*')
        .eq('event_id', EVENT_ID)
        .ilike('phone', `%${TARGET_PHONE.slice(-9)}`);

    if (gErr || !guests || guests.length === 0) {
        console.error('❌ Could not find guest in database:', gErr);
        return;
    }

    const guest = guests[0];
    console.log(`✅ Found Guest: ${guest.name} (ID: ${guest.id}, RSVP Status: ${guest.rsvp_status})`);

    // Fetch Event Config
    const { data: event, error: eventErr } = await supabase
        .from('events')
        .select('*')
        .eq('id', EVENT_ID)
        .single();

    if (eventErr || !event) {
        console.error('❌ Could not fetch event:', eventErr);
        return;
    }

    const groomName = event.groom_name || 'محمد';
    const brideName = event.bride_name || 'اثير';
    const eventDate = event.date || '2026-06-05';
    const eventLocation = event.location || 'قاعة المخملية';
    const familyNameText = event.settings?.family_name || '';
    const headerImage = event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png';
    const templateName = event.template_name || 'lony';

    const senderName = familyNameText ? `زفاف آل ${familyNameText}` : `${event.name || 'زفافنا العزيز'}`;

    console.log(`ℹ️ [Dynamic Sender Name Text]:\n"${senderName}"\n`);

    // Step 1. Save stashed invitation (marketing payload) in guest record
    const invitationPayload = {
        messaging_product: 'whatsapp', to: TARGET_PHONE, type: 'template',
        template: {
            name: templateName, language: { code: 'ar' },
            components: [
                { type: 'header', parameters: [{ type: 'image', image: { link: headerImage } }] },
                { type: 'body', parameters: [
                    { type: 'text', parameter_name: 'guest_name', text: guest.name }, 
                    { type: 'text', parameter_name: 'groom_name', text: groomName }, 
                    { type: 'text', parameter_name: 'bride_name', text: brideName }, 
                    { type: 'text', parameter_name: 'event_date', text: eventDate }, 
                    { type: 'text', parameter_name: 'event_location', text: eventLocation }
                ] },
                { type: 'button', sub_type: 'quick_reply', index: 0, parameters: [{ type: 'payload', payload: 'CONFIRM' }] },
                { type: 'button', sub_type: 'quick_reply', index: 1, parameters: [{ type: 'payload', payload: 'DECLINE' }] },
                { type: 'button', sub_type: 'url', index: 2, parameters: [{ type: 'text', text: encodeURIComponent(event.location_maps_url || eventLocation) }] }
            ]
        }
    };

    console.log('📝 Stashing invitation payload...');
    const { error: updateErr } = await supabase
        .from('guests')
        .update({ pending_marketing_data: invitationPayload })
        .eq('id', guest.id);

    if (updateErr) {
        console.error('❌ Failed to stash invitation payload:', updateErr);
        return;
    }
    console.log('✅ Invitation payload stashed successfully.');

    // Step 2. Build bridge payload
    const bridgePayload = {
        messaging_product: 'whatsapp', to: TARGET_PHONE, type: 'template',
        template: {
            name: 'lony_invite_bridge', language: { code: 'ar' },
            components: [{ 
                type: 'body', 
                parameters: [
                    { type: 'text', parameter_name: 'guest_name', text: guest.name }, 
                    { type: 'text', parameter_name: 'sender_name', text: senderName }
                ] 
            }]
        }
    };

    console.log('🚀 Sending bridge template to Meta API...');
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(bridgePayload)
    });

    const metaData = await metaRes.json();

    if (metaRes.ok) {
        console.log('✅ Bridge sent successfully to Meta.');
        console.log('Evolution Message ID:', metaData.messages?.[0]?.id);

        // Record message in db
        const { error: insertErr } = await supabase.from('whatsapp_messages').insert({
            guest_id: guest.id, 
            event_id: EVENT_ID, 
            phone: TARGET_PHONE, 
            status: 'sent', 
            delivery_status: 'sent',
            evolution_message_id: metaData.messages?.[0]?.id,
            message_phase: 'bridge',
            message_text: 'رسالة تمهيدية (جسر العبور)'
        });

        if (insertErr) {
            console.error('❌ Failed to insert message log in db:', insertErr);
        } else {
            console.log('✅ Message log inserted successfully.');
        }

        // Update guest status
        const { error: statusErr } = await supabase
            .from('guests')
            .update({ status: 'bridging' })
            .eq('id', guest.id);

        if (statusErr) {
            console.error('❌ Failed to update guest status:', statusErr);
        } else {
            console.log('✅ Guest status updated to "bridging" successfully.');
        }

    } else {
        console.error('❌ Meta API returned error:', JSON.stringify(metaData));
    }
}

testSingleBridge();
