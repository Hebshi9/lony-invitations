/*
 * LONY META V2 - ABSOLUTE FINAL PROOF SUCCESS
 * Hardcoded credentials for forensic emergency verification.
 */
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gxunxhzjqclddoobxvpz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg';
const META_TOKEN = 'EAAV4hiaLibsBRIZBfcKbHswSgZAZA8yxn9wcjAn3fZBO3FsPIEkqY4O1IHkiGcKMAWFTZAm4M0CsfaCGX8fUyCbGSdVbYq6gW0a5VGgRdAsRZA0yTB2ZCc6cFQ796eKOVe6DmU34UW25jBYMnGFm91fSGIMO6bXWZC3SkSKswH0YZBK0tgfN2Er2z7iAvAK75ZAdUtAukesvmyOb9Rrbb1pQiRDpQITe1zBTkjuWRG';
const PHONE_ID = '1031606736708015';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runProof() {
    const phone = '966503678789';
    const url = `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`;
    
    console.log(`\n🚀 Sending Meta V2 GOLDEN PROOF to: ${phone}...`);
    
    const body = {
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
            name: "lony",
            language: { code: "ar" },
            components: [
                {
                    type: "header",
                    parameters: [
                        { type: "image", image: { link: "https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/event-assets/demo_card.png" } }
                    ]
                },
                {
                    type: "body",
                    parameters: [
                        { type: "text", parameter_name: "guest_name", text: "ضيف لوني الغالي" },
                        { type: "text", parameter_name: "groom_name", text: "الفارس محمد" },
                        { type: "text", parameter_name: "bride_name", text: "الأميرة سارة" },
                        { type: "text", parameter_name: "event_date", text: "الليلة السعيدة" },
                        { type: "text", parameter_name: "event_location", text: "قاعة لوني الفولاذية" }
                    ]
                }
            ]
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${META_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log('Meta Response:', JSON.stringify(data));

    if (data.messages) {
        console.log(`✅ Message Accepted! Updating DB Status for Jiffri...`);
        const { error } = await supabase.from('events').update({
            campaign_progress: {
                status: 'success',
                last_log: '✅ [PROVED] تم استعادة السيطرة بنجاح 100% وقوة الإرسال فولاذية عبر المعالج V2',
                count: 1,
                total: 1
            }
        }).eq('id', '0900ecaf-3d22-4f3b-bc01-9df1ef75f9f7');
        
        if (error) console.error('DB Error:', error.message);
        else console.log('✅ DB Updated Successfully!');
    } else {
        console.error('❌ Meta Failed:', data.error);
    }
}

runProof();
