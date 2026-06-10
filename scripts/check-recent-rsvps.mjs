import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';
const START_OF_CAMPAIGN_UTC = new Date('2026-05-21T16:25:00Z');

async function checkRecentRSVPs() {
    // 1. Fetch recent bridge messages to get target guest IDs
    const { data: messages, error: msgError } = await supabase
        .from('whatsapp_messages')
        .select('guest_id')
        .eq('event_id', EVENT_ID)
        .eq('message_phase', 'bridge')
        .gte('created_at', START_OF_CAMPAIGN_UTC.toISOString());

    if (msgError) {
        console.error('Error fetching messages:', msgError);
        return;
    }

    const guestIds = [...new Set(messages.map(m => m.guest_id))];

    if (guestIds.length === 0) {
        console.log('No recent bridge messages found.');
        return;
    }

    // 2. Fetch the current RSVP status of these specific guests
    const { data: guests, error: guestError } = await supabase
        .from('guests')
        .select('name, phone, rsvp_status, status, updated_at')
        .in('id', guestIds);

    if (guestError) {
        console.error('Error fetching guests status:', guestError);
        return;
    }

    const confirmed = [];
    const declined = [];
    const pending = [];

    guests.forEach(g => {
        if (g.rsvp_status === 'confirmed') {
            confirmed.push(g);
        } else if (g.rsvp_status === 'declined') {
            declined.push(g);
        } else {
            pending.push(g);
        }
    });

    console.log(`\n=============================================`);
    console.log(`🗳️ Live RSVP Status of Recent Bridge Recipients`);
    console.log(`=============================================`);
    console.log(`Total Recipients Checked: ${guests.length}`);
    console.log(`✅ Confirmed (تم التأكيد): ${confirmed.length}`);
    console.log(`❌ Declined (اعتذروا): ${declined.length}`);
    console.log(`⏳ Still Pending (معلق/لم يحدد بعد): ${pending.length}`);
    console.log(`=============================================\n`);

    if (confirmed.length > 0) {
        console.log('--- ✅ Confirmed Guests ---');
        confirmed.forEach((g, i) => {
            console.log(`${i+1}. ${g.name} (${g.phone}) - Updated: ${new Date(g.updated_at).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}`);
        });
        console.log();
    }

    if (declined.length > 0) {
        console.log('--- ❌ Declined Guests ---');
        declined.forEach((g, i) => {
            console.log(`${i+1}. ${g.name} (${g.phone}) - Updated: ${new Date(g.updated_at).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })}`);
        });
        console.log();
    }
}

checkRecentRSVPs();
