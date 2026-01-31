import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function debugWhatsApp() {
    console.log('🔍 WhatsApp Debugging Report\n');
    console.log('='.repeat(50));

    // 1. Check Events
    console.log('\n📅 EVENTS:');
    const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (eventsError) {
        console.error('❌ Error fetching events:', eventsError);
    } else {
        console.log(`Found ${events.length} recent events:`);
        events.forEach(event => {
            console.log(`  - ${event.name} (${event.id})`);
        });
    }

    // 2. Check Guests
    console.log('\n👥 GUESTS:');
    if (events && events.length > 0) {
        const eventId = events[0].id;
        const { data: guests, error: guestsError } = await supabase
            .from('guests')
            .select('*')
            .eq('event_id', eventId);

        if (guestsError) {
            console.error('❌ Error fetching guests:', guestsError);
        } else {
            console.log(`Event: ${events[0].name}`);
            console.log(`Total guests: ${guests.length}`);
            console.log('\nSample guests:');
            guests.slice(0, 5).forEach(guest => {
                console.log(`  - ${guest.name}: ${guest.phone} (RSVP: ${guest.rsvp_status || 'pending'})`);
            });
        }
    }

    // 3. Check WhatsApp Messages
    console.log('\n📱 WHATSAPP MESSAGES:');
    if (events && events.length > 0) {
        const eventId = events[0].id;
        const { data: messages, error: messagesError } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('event_id', eventId);

        if (messagesError) {
            console.error('❌ Error fetching messages:', messagesError);
        } else {
            console.log(`Total messages: ${messages.length}`);

            const statusCounts = {};
            messages.forEach(msg => {
                statusCounts[msg.status] = (statusCounts[msg.status] || 0) + 1;
            });

            console.log('\nMessage statuses:');
            Object.entries(statusCounts).forEach(([status, count]) => {
                console.log(`  - ${status}: ${count}`);
            });

            console.log('\nSample messages:');
            messages.slice(0, 3).forEach(msg => {
                console.log(`  - ${msg.phone}: ${msg.status} (Phase: ${msg.message_phase || 'N/A'})`);
            });
        }
    }

    // 4. Check WhatsApp Accounts
    console.log('\n📞 WHATSAPP ACCOUNTS:');
    const { data: accounts, error: accountsError } = await supabase
        .from('whatsapp_accounts')
        .select('*');

    if (accountsError) {
        console.error('❌ Error fetching accounts:', accountsError);
    } else {
        console.log(`Total accounts: ${accounts.length}`);
        accounts.forEach(acc => {
            console.log(`  - ${acc.name || acc.phone || acc.id}: ${acc.status} (${acc.messages_sent_today || 0}/170 today)`);
        });
    }

    // 5. Check WhatsApp Replies
    console.log('\n💬 WHATSAPP REPLIES:');
    const { data: replies, error: repliesError } = await supabase
        .from('whatsapp_replies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (repliesError) {
        console.error('❌ Error fetching replies:', repliesError);
    } else {
        console.log(`Total recent replies: ${replies.length}`);
        replies.forEach(reply => {
            console.log(`  - ${reply.phone}: "${reply.reply_text.substring(0, 30)}..." (RSVP: ${reply.rsvp_response || 'N/A'})`);
        });
    }

    // 6. Test RSVP Stats Function
    console.log('\n📊 RSVP STATISTICS:');
    if (events && events.length > 0) {
        const eventId = events[0].id;
        const { data: stats, error: statsError } = await supabase
            .rpc('get_event_rsvp_stats', { event_uuid: eventId });

        if (statsError) {
            console.error('❌ Error fetching stats:', statsError);
            console.log('Note: You may need to run the migration first!');
        } else {
            console.log('Event:', events[0].name);
            console.log('Stats:', stats);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Debug report complete!\n');
}

debugWhatsApp().catch(console.error);
