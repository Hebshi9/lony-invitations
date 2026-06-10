import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

// Start of today (May 21, 2026) in Saudi Time (+03:00) is May 20, 2026 21:00:00 UTC
const START_OF_TODAY_UTC = new Date('2026-05-20T21:00:00Z');

async function filterBridgeGuests() {
    const { data: guests, error } = await supabase
        .from('guests')
        .select('*, whatsapp_messages(*)')
        .eq('event_id', EVENT_ID);

    if (error) {
        console.error('Error fetching guests:', error);
        return;
    }

    // 1. Exclude confirmed and declined
    const pendingGuests = guests.filter(g => {
        // Exclude test numbers
        if (g.phone.includes('96650000000')) return false;
        
        const rsvp = g.rsvp_status;
        return rsvp !== 'confirmed' && rsvp !== 'declined';
    });

    const sentBridgeToday = [];
    const sentBridgeBeforeToday = [];
    const neverSentBridge = [];

    pendingGuests.forEach(g => {
        const bridgeMessages = g.whatsapp_messages?.filter(m => m.message_phase === 'bridge') || [];
        
        if (bridgeMessages.length > 0) {
            // Find if any bridge message was sent today
            const hasBridgeToday = bridgeMessages.some(m => new Date(m.created_at) >= START_OF_TODAY_UTC);
            
            if (hasBridgeToday) {
                sentBridgeToday.push(g);
            } else {
                // Find latest bridge message date
                const latestBridge = bridgeMessages.reduce((latest, m) => {
                    return new Date(m.created_at) > new Date(latest.created_at) ? m : latest;
                }, bridgeMessages[0]);
                
                sentBridgeBeforeToday.push({
                    guest: g,
                    sentAt: new Date(latestBridge.created_at).toLocaleString('en-US', { timeZone: 'Asia/Riyadh' })
                });
            }
        } else {
            neverSentBridge.push(g);
        }
    });

    console.log(`\n=============================================`);
    console.log(`📊 Filtered Bridge Analysis (Pending/None RSVP Guests)`);
    console.log(`=============================================`);
    console.log(`📅 Today (Saudi Time) Start: ${START_OF_TODAY_UTC.toISOString()} (UTC)`);
    console.log(`1. Sent Bridge TODAY (تم إرسال الجسر لهم اليوم): ${sentBridgeToday.length}`);
    console.log(`2. Sent Bridge BEFORE Today (تم إرسال الجسر لهم سابقاً): ${sentBridgeBeforeToday.length}`);
    console.log(`3. Never Sent Bridge (لم يتم إرسال الجسر لهم مطلقاً): ${neverSentBridge.length}`);
    console.log(`=============================================\n`);

    console.log(`--- 1. Sent Bridge TODAY (${sentBridgeToday.length}) ---`);
    sentBridgeToday.forEach((g, i) => {
        console.log(`${i+1}. ${g.name} (${g.phone})`);
    });

    console.log(`\n--- 2. Sent Bridge BEFORE Today (${sentBridgeBeforeToday.length}) ---`);
    sentBridgeBeforeToday.forEach((item, i) => {
        console.log(`${i+1}. ${item.guest.name} (${item.guest.phone}) - Sent at: ${item.sentAt}`);
    });

    console.log(`\n--- 3. Never Sent Bridge (${neverSentBridge.length}) ---`);
    neverSentBridge.forEach((g, i) => {
        console.log(`${i+1}. ${g.name} (${g.phone})`);
    });
}

filterBridgeGuests();
