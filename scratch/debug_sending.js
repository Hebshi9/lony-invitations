
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function checkStatus() {
    console.log("🔍 Checking Event Campaign Status...");
    const { data: events } = await supabase.from('events').select('id, name, campaign_status, campaign_progress').order('updated_at', { ascending: false }).limit(1);
    console.log("Latest Event:", JSON.stringify(events[0], null, 2));

    console.log("\n📩 Checking Recent WhatsApp Messages...");
    const { data: messages } = await supabase.from('whatsapp_messages').select('*').order('created_at', { ascending: false }).limit(5);
    console.log(JSON.stringify(messages, null, 2));
}

checkStatus();
