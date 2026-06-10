import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0';
const META_TOKEN = process.env.META_ACCESS_TOKEN || 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';
const PHONE_ID = process.env.META_PHONE_NUMBER_ID || '1031606736708015';

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_GUEST_ID = 'f5c43d98-1b37-46c1-a915-6744a832831c'; // guest "احمد"
const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
const TARGET_PHONE = '966503678789';

async function sendDirectTest() {
    console.log(`Starting direct live test to ${TARGET_PHONE}...`);
    
    // 1. Get Event Data
    const { data: event } = await supabase.from('events').select('*').eq('id', EVENT_ID).single();
    const { data: guest } = await supabase.from('guests').select('*').eq('id', TEST_GUEST_ID).single();
    
    if (!event || !guest) {
        console.error("Could not load event or guest info from DB");
        return;
    }

    const groomName = event.groom_name || 'العريس';
    const eventLocation = event.location || event.location_name || 'الموقع';
    const templateName = event.template_name || 'get_update';
    const headerImage = event.settings?.global_invite_image_url || 'https://lonyinvite.netlify.app/card-placeholder.png';

    // We will test sending the bridge message (since that's the first step)
    console.log("Preparing bridge template payload...");
    const payload = {
        messaging_product: 'whatsapp',
        to: TARGET_PHONE,
        type: 'template',
        template: {
            name: 'lony_invite_bridge',
            language: { code: 'ar' },
            components: [{ 
                type: 'body', 
                parameters: [
                    { type: 'text', parameter_name: 'guest_name', text: guest.name }, 
                    { type: 'text', parameter_name: 'sender_name', text: event.settings?.family_name ? `زفاف آل ${event.settings.family_name}` : (event.name || 'زفافنا العزيز') }
                ] 
            }]
        }
    };

    console.log("Sending POST request to Meta API...");
    console.log(`URL: https://graph.facebook.com/v21.0/${PHONE_ID}/messages`);
    
    try {
        const metaRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${META_TOKEN}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const metaData = await metaRes.json();
        console.log("\n=============================================");
        console.log("Response Status:", metaRes.status, metaRes.statusText);
        console.log("Response Body:");
        console.log(JSON.stringify(metaData, null, 2));
        console.log("=============================================\n");
    } catch (e) {
        console.error("Error invoking Meta API:", e);
    }
}

sendDirectTest();
