import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const EVENT_ID = '0d9d3de0-562e-443f-8d57-4d9b653db4bf';

async function analyzeMessages() {
    console.log('🔍 Querying whatsapp_messages for Mohamed & Atheer...');
    
    const { data: messages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('event_id', EVENT_ID);

    if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return;
    }

    console.log(`Total messages in log: ${messages.length}`);

    const statusCounts = {};
    const deliveryCounts = {};
    const phaseCounts = {};
    const failedMessages = [];

    messages.forEach(m => {
        statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
        deliveryCounts[m.delivery_status] = (deliveryCounts[m.delivery_status] || 0) + 1;
        phaseCounts[m.message_phase] = (phaseCounts[m.message_phase] || 0) + 1;
        
        if (m.status === 'failed' || m.delivery_status === 'failed' || m.delivery_status === 'bridging' || m.delivery_status === 'pending') {
            failedMessages.push(m);
        }
    });

    console.log('\n--- Message Status (API response status) ---', statusCounts);
    console.log('\n--- Message Delivery Status (Webhook status) ---', deliveryCounts);
    console.log('\n--- Message Phase ---', phaseCounts);

    console.log(`\n--- Failed, Bridged, or Pending Messages (${failedMessages.length} total) ---`);
    
    // Fetch guest details for these messages to make it human-readable
    if (failedMessages.length > 0) {
        const guestIds = failedMessages.map(m => m.guest_id);
        const { data: guests } = await supabase
            .from('guests')
            .select('id, name, phone, status, rsvp_status')
            .in('id', guestIds);
            
        const guestMap = {};
        if (guests) {
            guests.forEach(g => {
                guestMap[g.id] = g;
            });
        }

        failedMessages.forEach(m => {
            const guest = guestMap[m.guest_id] || { name: 'Unknown', phone: m.phone, status: 'Unknown', rsvp_status: 'Unknown' };
            console.log(`- Guest: ${guest.name} (${guest.phone})`);
            console.log(`  RSVP: ${guest.rsvp_status} | Guest Status: ${guest.status}`);
            console.log(`  Message ID: ${m.id} | Phase: ${m.message_phase}`);
            console.log(`  Status: ${m.status} | Delivery: ${m.delivery_status}`);
            console.log(`  Error Message: ${m.error_message || 'None'}`);
            console.log(`  Created At: ${m.created_at}`);
            console.log('----------------------------------------------------');
        });
    }
}

analyzeMessages();
