import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const GUEST_IDS = [
    'da753ec3-9a47-4bee-be3e-2e8271939d85', // عبير الشهري
    'da9d7ee0-7ce3-4fde-b695-156372224ff0', // خلود قاري (Guest ID may vary, let's fetch them by phone/name)
];

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

async function checkAnyFailedMessages() {
    console.log("Checking any whatsapp_messages for the 8 failed guest phone numbers...");

    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*, guests(name, phone), events(name)')
        .in('phone', FAILED_PHONES);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${messages.length} total messages for these phone numbers in the database:`);
    messages.forEach((m, idx) => {
        console.log(`[${idx+1}] Guest: ${m.guests?.name || 'Unknown'} (${m.phone})`);
        console.log(`    Event: ${m.events?.name || 'Unknown'} (Event ID: ${m.event_id})`);
        console.log(`    Phase: ${m.message_phase} | Status: ${m.status} | Delivery: ${m.delivery_status}`);
        console.log(`    Error Message: ${m.error_message}`);
        console.log(`    Created At: ${m.created_at}`);
        console.log("-----------------------------------------");
    });
}

checkAnyFailedMessages();
