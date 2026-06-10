import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function checkStuckMessages() {
    const { data: guests, error } = await supabase
        .from('guests')
        .select('*, whatsapp_messages(*)')
        .eq('event_id', EVENT_ID);

    if (error) {
        console.error('Error fetching guests:', error);
        return;
    }

    console.log(`\n=============================================`);
    console.log(`🔍 Stuck Messages Audit`);
    console.log(`=============================================`);
    console.log(`Total Guests in Event: ${guests.length}`);

    // Exclude confirmed/declined/test numbers
    const activePending = guests.filter(g => {
        if (g.phone.includes('96650000000')) return false;
        return g.rsvp_status !== 'confirmed' && g.rsvp_status !== 'declined';
    });

    console.log(`Active Pending/None Guests: ${activePending.length}`);

    const statusBreakdown = {};
    const missingBridge = [];
    const failedMessages = [];

    activePending.forEach(g => {
        const guestStatus = g.status || 'no_status';
        statusBreakdown[guestStatus] = (statusBreakdown[guestStatus] || 0) + 1;

        // Check latest message
        const messages = g.whatsapp_messages || [];
        const bridgeMessages = messages.filter(m => m.message_phase === 'bridge');
        
        if (bridgeMessages.length === 0) {
            missingBridge.push(g);
        }

        // Check if any message failed
        const failed = messages.filter(m => m.status === 'failed' || m.delivery_status === 'failed');
        if (failed.length > 0) {
            failedGuests.push({
                guest: g,
                errors: failed.map(f => f.error_message)
            });
        }
    });

    console.log(`\n--- Guest Status Attribute Breakdown ---`);
    Object.keys(statusBreakdown).forEach(st => {
        console.log(`- ${st}: ${statusBreakdown[st]}`);
    });

    console.log(`\n- Guests with NO bridge message sent ever: ${missingBridge.length}`);
    if (missingBridge.length > 0) {
        missingBridge.forEach((g, i) => console.log(`  ${i+1}. ${g.name} (${g.phone})`));
    }

    console.log(`- Guests with failed messages logs: ${failedMessages.length}`);
    if (failedMessages.length > 0) {
        failedMessages.forEach((item, i) => {
            console.log(`  ${i+1}. ${item.guest.name} (${item.guest.phone}) - Errors: ${item.errors.join(', ')}`);
        });
    }
    console.log(`=============================================\n`);
}

// Helper arrays
const failedGuests = [];

checkStuckMessages();
