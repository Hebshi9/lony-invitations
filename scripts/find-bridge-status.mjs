import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function analyzeBridgeStatus() {
    const { data: guests, error } = await supabase
        .from('guests')
        .select('*, whatsapp_messages(*)')
        .eq('event_id', EVENT_ID);

    if (error) {
        console.error('Error fetching guests:', error);
        return;
    }

    // Filter guests who haven't responded (rsvp_status === 'pending' or empty/none)
    const pendingGuests = guests.filter(g => !g.rsvp_status || g.rsvp_status === 'pending' || g.rsvp_status === 'none');

    const sentBridge = [];
    const notSentBridge = [];

    pendingGuests.forEach(g => {
        const hasBridge = g.whatsapp_messages?.some(m => m.message_phase === 'bridge');
        if (hasBridge) {
            sentBridge.push(g);
        } else {
            notSentBridge.push(g);
        }
    });

    console.log(`\n=============================================`);
    console.log(`📊 Bridge Message Analysis for Unresolved Guests (Total Unresolved: ${pendingGuests.length})`);
    console.log(`=============================================`);
    console.log(`✅ Sent Bridge Message (تم إرسال الجسر لهم): ${sentBridge.length}`);
    console.log(`❌ NOT Sent Bridge Message (لم يتم إرسال الجسر لهم بعد): ${notSentBridge.length}`);
    console.log(`=============================================\n`);

    console.log(`--- list: Sent Bridge (${sentBridge.length}) ---`);
    sentBridge.forEach((g, i) => {
        console.log(`${i+1}. ${g.name} (${g.phone})`);
    });

    console.log(`\n--- list: NOT Sent Bridge (${notSentBridge.length}) ---`);
    notSentBridge.forEach((g, i) => {
        console.log(`${i+1}. ${g.name} (${g.phone})`);
    });
}

analyzeBridgeStatus();
