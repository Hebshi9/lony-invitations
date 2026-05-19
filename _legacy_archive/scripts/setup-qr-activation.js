import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MzAzNDMsImV4cCI6MjA4MDEwNjM0M30.OoOj_c7cqbsO_lzFKSM6hhPAg2F_F5gpRwBgDh74TXg'
);

async function setupQRActivation() {
    console.log('Setting up QR activation test data...\n');

    // Get first event
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id, name')
        .limit(1);

    if (eventError || !events || events.length === 0) {
        console.error('Error fetching event:', eventError);
        return;
    }

    const event = events[0];
    console.log(`Using event: ${event.name} (${event.id})\n`);

    // Get current time
    const now = new Date();

    // Test Case 1: QR Active (current time)
    const activeFrom = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
    const activeUntil = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now

    // Test Case 2: QR Not Started (future)
    const futureFrom = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days from now
    const futureUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

    // Test Case 3: QR Expired (past)
    const pastFrom = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const pastUntil = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

    console.log('Test scenarios:');
    console.log('1. ACTIVE: From 1 hour ago to 23 hours from now');
    console.log('2. NOT STARTED: From 2 days from now to 3 days from now');
    console.log('3. EXPIRED: From 3 days ago to 2 days ago\n');

    // Update event with ACTIVE window (default)
    const { error: updateError } = await supabase
        .from('events')
        .update({
            qr_activation_enabled: true,
            qr_active_from: activeFrom.toISOString(),
            qr_active_until: activeUntil.toISOString()
        })
        .eq('id', event.id);

    if (updateError) {
        console.error('Error updating event:', updateError);
        return;
    }

    console.log('✅ Event updated with ACTIVE QR window');
    console.log(`   From: ${activeFrom.toLocaleString('ar-SA')}`);
    console.log(`   Until: ${activeUntil.toLocaleString('ar-SA')}\n`);

    // Get guests for this event
    const { data: guests, error: guestError } = await supabase
        .from('guests')
        .select('id, name, qr_token')
        .eq('event_id', event.id)
        .limit(3);

    if (guestError || !guests || guests.length === 0) {
        console.error('Error fetching guests:', guestError);
        return;
    }

    console.log('Test URLs:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (guests[0]) {
        console.log(`\n✅ ACTIVE (يشتغل الآن):`);
        console.log(`Guest: ${guests[0].name}`);
        console.log(`URL: https://lonyinvite.netlify.app/v/${guests[0].qr_token}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nTo test NOT STARTED scenario, run:');
    console.log(`UPDATE events SET qr_active_from = '${futureFrom.toISOString()}', qr_active_until = '${futureUntil.toISOString()}' WHERE id = '${event.id}';`);

    console.log('\nTo test EXPIRED scenario, run:');
    console.log(`UPDATE events SET qr_active_from = '${pastFrom.toISOString()}', qr_active_until = '${pastUntil.toISOString()}' WHERE id = '${event.id}';`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

setupQRActivation().catch(console.error);
