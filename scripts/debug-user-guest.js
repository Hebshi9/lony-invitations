import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const phone = '966503678789'; // Using the phone found in recent logs as a lead

async function debugGuest() {
    console.log(`🔍 Debugging Guest: ${phone}\n`);

    // 1. Guest Record
    const { data: guest } = await supabase
        .from('guests')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();
    
    if (guest) {
        console.log('✅ Guest Record Found:');
        console.log(`   Name: ${guest.name}`);
        console.log(`   RSVP Status: ${guest.rsvp_status}`);
        console.log(`   Card URL: ${guest.card_image_url || 'MISSING'}`);
        console.log(`   Event ID: ${guest.event_id}`);
    } else {
        console.log('❌ Guest Record NOT FOUND for this phone.');
    }

    // 2. Recent Messages to this guest
    console.log('\n--- Recent Messages To Guest ---');
    const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(5);
    
    messages?.forEach(m => {
        console.log(`[${m.created_at}] Phase: ${m.message_phase} | Status: ${m.status} | Text: ${m.message_text?.substring(0, 30)}...`);
    });

    // 3. Recent Replies from this guest
    console.log('\n--- Recent Replies From Guest (whatsapp_replies) ---');
    const { data: replies } = await supabase
        .from('whatsapp_replies')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: false });
    
    if (replies && replies.length > 0) {
        replies.forEach(r => {
            console.log(`[${r.created_at}] Text: ${r.reply_text} | RSVP: ${r.rsvp_response}`);
        });
    } else {
        console.log('ℹ️ No replies recorded in DB for this phone.');
    }
}

debugGuest();
