import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkRecentActivity() {
    console.log('🔍 Checking recent activity...\n');

    console.log('--- Latest 5 WhatsApp Messages ---');
    const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    
    messages?.forEach(m => {
        console.log(`[${m.created_at}] To: ${m.phone} | Phase: ${m.message_phase} | Status: ${m.status} | Text: ${m.message_text?.substring(0, 50)}...`);
    });

    console.log('\n--- Latest 5 RSVP Replies ---');
    const { data: replies } = await supabase
        .from('whatsapp_replies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
    
    replies?.forEach(r => {
        console.log(`[${r.created_at}] From: ${r.phone} | Text: ${r.reply_text} | RSVP: ${r.rsvp_response} | Conf: ${r.ai_confidence}`);
    });
}

checkRecentActivity();
