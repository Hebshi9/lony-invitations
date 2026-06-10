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
const START_OF_TODAY_UTC = new Date('2026-05-20T21:00:00Z'); // Start of May 21st, 2026 AST (UTC+3)

async function sendBridgeBulk() {
    console.log('🚀 بدء تشغيل سكريبت الإرسال الجماعي للجسر اليدوي...');
    
    // 1. Fetch Event Config
    const { data: event, error: eventErr } = await supabase.from('events').select('*').eq('id', EVENT_ID).single();
    if (eventErr || !event) {
        console.error('❌ خطأ في جلب بيانات المناسبة:', eventErr);
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
    console.log(`ℹ️ النص الداينميكي للمرسل في الجسر:\n"${senderName}"\n`);

    // 2. Fetch Guests
    const { data: guests, error: guestsErr } = await supabase
        .from('guests')
        .select('*, whatsapp_messages(*)')
        .eq('event_id', EVENT_ID);

    if (guestsErr) {
        console.error('❌ خطأ في جلب الضيوف:', guestsErr);
        return;
    }

    // Filter target guests (pending, no bridge sent today)
    const targetGuests = guests.filter(g => {
        // Exclude test numbers
        if (g.phone.includes('96650000000')) return false;
        
        // Exclude confirmed and declined
        const rsvp = g.rsvp_status;
        if (rsvp === 'confirmed' || rsvp === 'declined') return false;

        // Exclude those who received a bridge message today
        const bridgeMessages = g.whatsapp_messages?.filter(m => m.message_phase === 'bridge') || [];
        const hasBridgeToday = bridgeMessages.some(m => new Date(m.created_at) >= START_OF_TODAY_UTC);
        
        return !hasBridgeToday;
    });

    console.log(`🎯 عدد الضيوف المستهدفين الفعليين للإرسال: ${targetGuests.length}`);
    if (targetGuests.length === 0) {
        console.log('✅ لا يوجد ضيوف مستهدفين حالياً للإرسال.');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < targetGuests.length; i++) {
        const guest = targetGuests[i];
        
        let phone = (guest.phone || '').replace(/\D/g, '');
        if (phone.startsWith('05')) phone = '966' + phone.substring(1);
        else if (phone.startsWith('5') && phone.length === 9) phone = '966' + phone;

        console.log(`[${i+1}/${targetGuests.length}] جاري معالجة الضيف: ${guest.name} (${phone})...`);

        try {
            // A. Store invitation payload in guests table under pending_marketing_data
            const invitationPayload = {
                messaging_product: 'whatsapp', to: phone, type: 'template',
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
            
            await supabase.from('guests').update({ pending_marketing_data: invitationPayload }).eq('id', guest.id);

            // B. Build bridge payload
            const bridgePayload = {
                messaging_product: 'whatsapp', to: phone, type: 'template',
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

            // C. Send to Meta API
            const metaRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(bridgePayload)
            });

            const metaData = await metaRes.json();

            if (metaRes.ok) {
                // D. Insert message log and update guest status
                await supabase.from('whatsapp_messages').insert({
                    guest_id: guest.id, 
                    event_id: EVENT_ID, 
                    phone: phone, 
                    status: 'sent', 
                    delivery_status: 'sent',
                    evolution_message_id: metaData.messages?.[0]?.id,
                    message_phase: 'bridge',
                    message_text: 'رسالة تمهيدية (جسر العبور)'
                });
                
                await supabase.from('guests').update({ status: 'bridging' }).eq('id', guest.id);
                console.log(`   ✅ تم الإرسال بنجاح وتحديث الحالة لـ ${guest.name}.`);
                successCount++;
            } else {
                const errorMsg = metaData.error?.message || 'Meta Error';
                console.error(`   ❌ فشل الإرسال لـ ${guest.name}. السبب: ${errorMsg}`);
                await supabase.from('whatsapp_messages').insert({ guest_id: guest.id, event_id: EVENT_ID, status: 'failed', error_message: errorMsg });
                await supabase.from('guests').update({ status: 'failed' }).eq('id', guest.id);
                failCount++;
            }

        } catch (error) {
            console.error(`   ❌ حدث خطأ غير متوقع أثناء إرسال لـ ${guest.name}:`, error.message);
            failCount++;
        }

        // Wait 2.5 seconds to avoid spam rate limiting
        await new Promise(resolve => setTimeout(resolve, 2500));
    }

    console.log(`\n🎉 اكتمل الإرسال الجماعي بنجاح.`);
    console.log(`- تم بنجاح: ${successCount}`);
    console.log(`- فشل: ${failCount}`);
}

sendBridgeBulk();
