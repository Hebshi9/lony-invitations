const path = require('path');
require('dotenv').config({ path: 'c:/Users/user/Documents/New folder (3)/lony-invitations-frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const PHONE_ID = process.env.META_PHONE_NUMBER_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTest() {
    console.log('🚀 Starting Full Meta Cycle Test (Named Parameters)...');
    const testPhone = '966503678789';

    try {
        // 1. Create a Test Event
        console.log('1. Creating test event...');
        const { data: event, error: eErr } = await supabase.from('events').insert({
            name: 'حفل تجربة نظام لوني - النهائي',
            date: '2026-05-20',
            location: 'قاعة لوني الكبرى - الرياض',
            token: 'test-final-' + Math.random().toString(36).substr(2, 9),
            settings: {
                groom_name: 'مشاري (تجربة)',
                bride_name: 'رهف (تجربة)',
                global_invite_image_url: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/global-invitations/sample_invite.jpg'
            }
        }).select().single();

        if (eErr) throw eErr;

        // 2. Create a Test Guest
        console.log('2. Creating test guest...');
        const { data: guest, error: gErr } = await supabase.from('guests').insert({
            event_id: event.id,
            name: 'ضيف تجربة نهائي',
            phone: testPhone,
            card_image_url: 'https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/sample_card.jpg',
            qr_token: 'test-final-' + Date.now()
        }).select().single();

        if (gErr) throw gErr;

        // 3. Trigger Phase 1 using NAMED parameters
        const templateName = 'lony'; 
        console.log(`3. Sending Phase 1 template: ${templateName} using named parameters...`);
        
        const payload = {
            messaging_product: 'whatsapp',
            to: testPhone,
            type: 'template',
            template: {
                name: templateName, 
                language: { code: 'ar' },
                components: [
                    {
                        type: 'header',
                        parameters: [{ type: 'image', image: { link: event.settings.global_invite_image_url } }]
                    },
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', parameter_name: 'guest_name', text: guest.name },
                            { type: 'text', parameter_name: 'groom_name', text: event.settings.groom_name },
                            { type: 'text', parameter_name: 'bride_name', text: event.settings.bride_name },
                            { type: 'text', parameter_name: 'event_date', text: event.date },
                            { type: 'text', parameter_name: 'event_location', text: event.location }
                        ]
                    }
                ]
            }
        };

        const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const metaData = await response.json();
        if (metaData.messages) {
            console.log('✅ Phase 1 Sent successfully! Check your phone.');
        } else {
            console.error('❌ Meta Error:', JSON.stringify(metaData, null, 2));
        }

    } catch (err) {
        console.error('❌ Test failed:', err.message);
    }
}

runTest();
