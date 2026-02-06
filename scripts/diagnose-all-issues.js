import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function diagnoseIssues() {
    console.log('🔍 Diagnosing WhatsApp System Issues\n');
    console.log('='.repeat(70));

    // Get all events
    const { data: events } = await supabase
        .from('events')
        .select('id, name')
        .order('created_at', { ascending: false });

    if (!events || events.length === 0) {
        console.log('\n❌ No events found');
        return;
    }

    console.log('\n📅 Available Events:');
    events.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.name} (${e.id.slice(0, 8)}...)`);
    });

    // Use first event for diagnosis
    const eventId = events[0].id;
    console.log(`\n🎯 Analyzing Event: ${events[0].name}\n`);

    // 1. Check Guests
    console.log('1️⃣ Checking Guests...');
    const { data: guests } = await supabase
        .from('guests')
        .select('id, name, phone, rsvp_status, card_image_url')
        .eq('event_id', eventId)
        .order('name');

    console.log(`   Total Guests: ${guests?.length || 0}`);

    if (guests && guests.length > 0) {
        console.log('\n   Guest Details:');
        guests.forEach((g, i) => {
            console.log(`   ${i + 1}. ${g.name}`);
            console.log(`      Phone: ${g.phone || 'MISSING!'}`);
            console.log(`      RSVP: ${g.rsvp_status || 'pending'}`);
            console.log(`      Has Card: ${g.card_image_url ? 'Yes' : 'No'}`);
        });

        // Check for duplicates
        const phones = guests.map(g => g.phone).filter(p => p);
        const uniquePhones = new Set(phones);
        if (phones.length !== uniquePhones.size) {
            console.log('\n   ⚠️  WARNING: Duplicate phone numbers detected!');
        }

        // Check for missing phones
        const missingPhones = guests.filter(g => !g.phone);
        if (missingPhones.length > 0) {
            console.log(`\n   ⚠️  WARNING: ${missingPhones.length} guests without phone numbers!`);
            missingPhones.forEach(g => console.log(`      - ${g.name}`));
        }
    }

    // 2. Check Messages
    console.log('\n\n2️⃣ Checking Messages...');
    const { data: messages } = await supabase
        .from('whatsapp_messages')
        .select('id, guest_id, phone, status, message_phase, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(50);

    console.log(`   Total Messages (last 50): ${messages?.length || 0}`);

    if (messages && messages.length > 0) {
        const stats = {};
        messages.forEach(m => {
            stats[m.status] = (stats[m.status] || 0) + 1;
        });

        console.log('\n   Status Breakdown:');
        Object.entries(stats).forEach(([status, count]) => {
            console.log(`      ${status}: ${count}`);
        });

        // Check for messages to wrong numbers
        const guestPhones = new Set(guests?.map(g => g.phone).filter(p => p) || []);
        const messagePhones = messages.map(m => m.phone);
        const wrongNumbers = messagePhones.filter(p => !guestPhones.has(p));

        if (wrongNumbers.length > 0) {
            console.log(`\n   🚨 CRITICAL: ${wrongNumbers.length} messages sent to WRONG numbers!`);
            const uniqueWrong = [...new Set(wrongNumbers)];
            uniqueWrong.forEach(p => console.log(`      - ${p}`));
        }
    }

    // 3. Check Replies
    console.log('\n\n3️⃣ Checking Replies...');
    const { data: replies } = await supabase
        .from('whatsapp_replies')
        .select('id, guest_id, reply_text, is_rsvp, rsvp_response, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(20);

    console.log(`   Total Replies (last 20): ${replies?.length || 0}`);

    if (replies && replies.length > 0) {
        console.log('\n   Recent Replies:');
        replies.slice(0, 5).forEach((r, i) => {
            const guest = guests?.find(g => g.id === r.guest_id);
            console.log(`   ${i + 1}. ${guest?.name || 'Unknown'}: "${r.reply_text}"`);
            console.log(`      RSVP: ${r.is_rsvp ? 'Yes' : 'No'}, Response: ${r.rsvp_response || 'N/A'}`);
        });
    } else {
        console.log('   ⚠️  No replies recorded - listener may not be working!');
    }

    // 4. Check Auto-sent Cards
    console.log('\n\n4️⃣ Checking Auto-sent Cards...');
    const confirmedGuests = guests?.filter(g => g.rsvp_status === 'confirmed') || [];
    console.log(`   Confirmed Guests: ${confirmedGuests.length}`);

    if (confirmedGuests.length > 0) {
        for (const guest of confirmedGuests) {
            const cardMessage = messages?.find(m =>
                m.guest_id === guest.id &&
                m.message_phase === 'personalized'
            );

            if (!cardMessage) {
                console.log(`   ⚠️  ${guest.name}: Confirmed but NO card sent!`);
            } else {
                console.log(`   ✅ ${guest.name}: Card sent (${cardMessage.status})`);
            }
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Diagnosis Complete\n');
}

diagnoseIssues().catch(console.error);
