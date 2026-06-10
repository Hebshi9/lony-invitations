import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

const MARRIAGE_EVENT_ID = 'ebdec964-18b4-4025-9a61-76c70d1732c0';

async function checkMarriageStats() {
    console.log(`🔍 Auditing "حفل زواج محمد & اثير" (ID: ${MARRIAGE_EVENT_ID})...`);

    const { data: event, error: eErr } = await supabase
        .from('events')
        .select('*')
        .eq('id', MARRIAGE_EVENT_ID)
        .single();

    if (eErr) {
        console.error('Error fetching event:', eErr);
        return;
    }

    console.log(`Event Details:`);
    console.log(`- Name: ${event.name}`);
    console.log(`- Date: ${event.date}`);
    console.log(`- Venue: ${event.venue}`);
    console.log(`- Campaign Status: ${event.campaign_status}`);
    console.log(`- Campaign Progress: ${JSON.stringify(event.campaign_progress)}`);

    const { data: guests, error: gErr } = await supabase
        .from('guests')
        .select('*, whatsapp_messages(*)')
        .eq('event_id', MARRIAGE_EVENT_ID);

    if (gErr) {
        console.error('Error fetching guests:', gErr);
        return;
    }

    console.log(`\nGuests count: ${guests.length}`);

    // RSVP counts
    const rsvpCounts = {
        pending: 0,
        confirmed: 0,
        declined: 0,
        none: 0
    };
    guests.forEach(g => {
        const rsvp = g.rsvp_status || 'none';
        rsvpCounts[rsvp] = (rsvpCounts[rsvp] || 0) + 1;
    });

    console.log('RSVP breakdown:');
    console.log(JSON.stringify(rsvpCounts, null, 2));

    // Message counts
    let totalMessages = 0;
    const msgStatuses = {};
    const msgPhases = {};

    guests.forEach(g => {
        const msgs = g.whatsapp_messages || [];
        totalMessages += msgs.length;
        msgs.forEach(m => {
            msgStatuses[m.delivery_status] = (msgStatuses[m.delivery_status] || 0) + 1;
            msgPhases[m.message_phase] = (msgPhases[m.message_phase] || 0) + 1;
        });
    });

    console.log(`\nTotal whatsapp messages sent: ${totalMessages}`);
    console.log('Message delivery statuses in DB:');
    console.log(JSON.stringify(msgStatuses, null, 2));
    console.log('Message phases:');
    console.log(JSON.stringify(msgPhases, null, 2));

    // Check confirmed guests QR card statuses
    const confirmedGuests = guests.filter(g => g.rsvp_status === 'confirmed');
    console.log(`\nConfirmed Guests count: ${confirmedGuests.length}`);

    let readQr = 0;
    let deliveredQr = 0;
    let sentQr = 0;
    let noQr = 0;
    const noQrGuests = [];
    const sentQrGuests = [];

    confirmedGuests.forEach(g => {
        const msgs = g.whatsapp_messages || [];
        const qrMsgs = msgs.filter(m => m.message_phase === 'qr_code');
        if (qrMsgs.length === 0) {
            noQr++;
            noQrGuests.push(g);
        } else {
            const latestQr = qrMsgs[qrMsgs.length - 1];
            if (latestQr.delivery_status === 'read') {
                readQr++;
            } else if (latestQr.delivery_status === 'delivered') {
                deliveredQr++;
            } else {
                sentQr++;
                sentQrGuests.push(g);
            }
        }
    });

    console.log(`QR Card delivery for confirmed guests:`);
    console.log(`- Read (opened by guest): ${readQr}`);
    console.log(`- Delivered (received on guest phone): ${deliveredQr}`);
    console.log(`- Sent (accepted by Meta, but not yet delivered): ${sentQr}`);
    console.log(`- Confirmed, but NO QR card sent yet: ${noQr}`);

    if (noQrGuests.length > 0) {
        console.log('\n⚠️ Confirmed guests with NO QR card sent:');
        noQrGuests.forEach(g => {
            console.log(`- ${g.name} (${g.phone})`);
        });
    }

    if (sentQrGuests.length > 0) {
        console.log('\n⏳ Confirmed guests with "Sent" QR card:');
        sentQrGuests.forEach(g => {
            console.log(`- ${g.name} (${g.phone})`);
        });
    }

    // Now let's calculate the "stuck" definition count for ALL guests
    const stuckGuests = guests.filter(g => {
        const msg = (g.whatsapp_messages || []).findLast(m => m.message_phase === 'invitation');
        const isStuck = msg?.status === 'sent' &&
            msg?.delivery_status === 'sent' &&
            (new Date().getTime() - new Date(msg.created_at).getTime() > 10 * 60 * 1000); // 10 Minutes
        return isStuck;
    });

    console.log(`\n=============================================`);
    console.log(`Guests classified as "Stuck" (عالقين): ${stuckGuests.length}`);
    console.log(`=============================================`);
    if (stuckGuests.length > 0) {
        console.log('Sample of stuck guests:');
        stuckGuests.slice(0, 10).forEach(g => {
            const msg = g.whatsapp_messages.findLast(m => m.message_phase === 'invitation');
            console.log(`- ${g.name} (${g.phone}) | RSVP: ${g.rsvp_status} | Msg Sent At: ${msg.created_at}`);
        });
    }
}

checkMarriageStats();
