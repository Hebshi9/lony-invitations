import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
// Sent since 19:25:00 local time today (which is 16:25:00 UTC)
const START_OF_CAMPAIGN_UTC = new Date('2026-05-21T16:25:00Z');

async function getRecentBridgeDetails() {
    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*, guests(name)')
        .eq('event_id', EVENT_ID)
        .eq('message_phase', 'bridge')
        .gte('created_at', START_OF_CAMPAIGN_UTC.toISOString());

    if (error) {
        console.error('Error fetching recent bridge messages:', error);
        return;
    }

    const stats = {
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0
    };

    const readGuests = [];
    const deliveredGuests = [];
    const sentGuests = [];
    const failedGuests = [];

    messages.forEach(m => {
        const guestName = m.guests?.name || 'مجهول';
        const status = m.delivery_status || m.status;

        const info = `${guestName} (${m.phone})`;

        if (status === 'read') {
            stats.read++;
            readGuests.push(info);
        } else if (status === 'delivered') {
            stats.delivered++;
            deliveredGuests.push(info);
        } else if (status === 'failed') {
            stats.failed++;
            failedGuests.push(`${info} - Error: ${m.error_message || 'Unknown'}`);
        } else {
            stats.sent++;
            sentGuests.push(info);
        }
    });

    console.log(`\n=============================================`);
    console.log(`📊 Campaign Analysis (Sent in the last 15 mins)`);
    console.log(`=============================================`);
    console.log(`Start Time: ${START_OF_CAMPAIGN_UTC.toISOString()} (UTC)`);
    console.log(`Total Messages Sent: ${messages.length}`);
    console.log(`📖 Read (تمت القراءة): ${stats.read}`);
    console.log(`✅ Delivered (وصلت لجوالاتهم): ${stats.delivered}`);
    console.log(`✉️ Sent (انتظار الشبكة/مرسلة): ${stats.sent}`);
    console.log(`❌ Failed (فشلت): ${stats.failed}`);
    console.log(`=============================================\n`);

    console.log(`--- Details of READ guests (${readGuests.length}) ---`);
    readGuests.forEach((g, i) => console.log(`${i+1}. ${g}`));

    console.log(`\n--- Details of DELIVERED guests (${deliveredGuests.length}) ---`);
    deliveredGuests.forEach((g, i) => console.log(`${i+1}. ${g}`));
}

getRecentBridgeDetails();
