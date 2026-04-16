import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function debugSara() {
    console.log("🔍 Searching for Sara's interactions...");
    const saraSuffix = '587248897'; // From screenshot: 966587248897
    
    // 1. Check if she responded recently
    const { data: logs, error } = await supabase
        .from('webhook_debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    console.log(`Found ${logs.length} total logs. Filtering for messages...`);
    
    logs.forEach((log, i) => {
        const body = log.payload;
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0]?.value;
        const message = changes?.messages?.[0];
        
        if (message) {
            console.log(`\n--- Log ${i} ---`);
            console.log(`From: ${message.from}`);
            console.log(`Type: ${message.type}`);
            if (message.button) console.log(`Button Text: "${message.button.text}"`);
            if (message.interactive) console.log(`Interactive:`, JSON.stringify(message.interactive.button_reply));
            if (message.text) console.log(`Text Body: "${message.text.body}"`);
            console.log(`Context ID: ${message.context?.id}`);
        }
    });

    // 2. Check Sara's guest record
    const { data: guest } = await supabase
        .from('guests')
        .select('id, name, phone, rsvp_status, whatsapp_messages(id, evolution_message_id, delivery_status)')
        .ilike('phone', `%${saraSuffix}`)
        .single();

    console.log("\n--- Sara's Guest Record ---");
    console.log(JSON.stringify(guest, null, 2));
}

debugSara();
