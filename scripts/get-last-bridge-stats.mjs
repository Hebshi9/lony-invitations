import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
const START_OF_TODAY_UTC = new Date('2026-05-20T21:00:00Z'); // May 21st, 2026 local time

async function getBridgeCampaignStats() {
    const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('*, guests(name)')
        .eq('event_id', EVENT_ID)
        .eq('message_phase', 'bridge')
        .gte('created_at', START_OF_TODAY_UTC.toISOString());

    if (error) {
        console.error('Error fetching bridge messages:', error);
        return;
    }

    const stats = {
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0
    };

    const failedDetails = [];
    const readDetails = [];
    const deliveredDetails = [];
    const sentDetails = [];

    messages.forEach(m => {
        const guestName = m.guests?.name || 'مجهول';
        const status = m.delivery_status || m.status;

        if (status === 'read') {
            stats.read++;
            readDetails.push(`${guestName} (${m.phone})`);
        } else if (status === 'delivered') {
            stats.delivered++;
            deliveredDetails.push(`${guestName} (${m.phone})`);
        } else if (status === 'failed') {
            stats.failed++;
            failedDetails.push(`${guestName} (${m.phone}) - Reason: ${m.error_message || 'Unknown'}`);
        } else {
            stats.sent++;
            sentDetails.push(`${guestName} (${m.phone})`);
        }
    });

    console.log(`\n=============================================`);
    console.log(`📊 Live Bridge Delivery Stats (Campaign Today)`);
    console.log(`=============================================`);
    console.log(`Total Messages Sent: ${messages.length}`);
    console.log(`📖 Read (تمت القراءة): ${stats.read}`);
    console.log(`✅ Delivered (وصلت): ${stats.delivered}`);
    console.log(`✉️ Sent (مرسلة/انتظار الشبكة): ${stats.sent}`);
    console.log(`❌ Failed (فشلت): ${stats.failed}`);
    console.log(`=============================================\n`);

    if (readDetails.length > 0) {
        console.log(`--- 📖 Read (${readDetails.length}) ---`);
        readDetails.forEach((d, i) => console.log(`${i+1}. ${d}`));
        console.log();
    }

    if (deliveredDetails.length > 0) {
        console.log(`--- ✅ Delivered (${deliveredDetails.length}) ---`);
        deliveredDetails.forEach((d, i) => console.log(`${i+1}. ${d}`));
        console.log();
    }

    if (failedDetails.length > 0) {
        console.log(`--- ❌ Failed (${failedDetails.length}) ---`);
        failedDetails.forEach((d, i) => console.log(`${i+1}. ${d}`));
        console.log();
    }
}

getBridgeCampaignStats();
