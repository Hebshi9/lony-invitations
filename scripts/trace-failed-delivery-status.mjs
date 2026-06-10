import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const FAILED_PHONES = [
    '966505424030', // عبير الشهري
    '966504685715', // خلود قاري
    '966561777611', // عبير الصالح
    '966530347444', // مروى
    '966563385523', // ليلى الطويرقي
    '966535303094', // هيفاء اللهبي
    '966533853535', // لطيفة الفارسي
    '966544131919'  // ليال تمار
];

async function traceDelivery() {
    console.log("Tracing delivery statuses from webhook updates...");

    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*, guests(name, phone), events(name)')
        .in('phone', FAILED_PHONES);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`\nFound ${messages.length} messages. Inspecting for any delivery_status = 'failed':`);
    messages.forEach((m) => {
        console.log(`- Guest: ${m.guests?.name} (${m.phone})`);
        console.log(`  Phase: ${m.message_phase}`);
        console.log(`  Send Status: ${m.status} | Webhook Delivery Status: ${m.delivery_status}`);
        console.log(`  Error: ${m.error_message}`);
        console.log(`  Created At: ${m.created_at}`);
        console.log(`  Delivered At: ${m.delivered_at} | Read At: ${m.read_at}`);
        console.log("------------------------------------------------");
    });
}

traceDelivery();
