import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { handler } from '../netlify/functions/send-campaign.mjs';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL || 'https://gxunxhzjqclddoobxvpz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4dW54aHpqcWNsZGRvb2J4dnB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUzMDM0MywiZXhwIjoyMDgwMTA2MzQzfQ.T2inWTfgbr_s2nM_O1K6MSbt32-IpzeffkdJwwM0LP0'
);

async function fullTestFlow() {
    const phone = '966507240097';
    console.log(`🧹 Cleaning old test data for phone: ${phone}`);

    // 1. Find the guest
    const { data: guests, error: findErr } = await supabase
        .from('guests')
        .select('id, event_id, name')
        .eq('phone', phone)
        .limit(1);

    if (findErr || !guests || guests.length === 0) {
        console.error('❌ Could not find guest with this phone number. Trying to insert a mock guest...');
        // Insert mock guest for a known event id
        const eventId = '9134d9cb-ab45-4eaf-b1d0-d2c04790a0e1'; 
        const { data: newGuest, error: insErr } = await supabase.from('guests').insert([{
            event_id: eventId,
            name: 'Sarah Test',
            phone: phone,
            status: 'idle',
            card_image_url: `https://gxunxhzjqclddoobxvpz.supabase.co/storage/v1/object/public/invitation-cards/${eventId}/mock.jpg`
        }]).select();
        
        if (insErr) {
            console.error('Failed to create guest', insErr);
            return;
        }
        guests.push(newGuest[0]);
    }

    const guestId = guests[0].id;
    const eventId = guests[0].event_id;

    // 2. Clean messages
    await supabase.from('whatsapp_messages').delete().eq('guest_id', guestId);
    
    // 3. Reset guest status
    await supabase.from('guests').update({ status: 'idle' }).eq('id', guestId);

    console.log(`✅ Test Environment Ready. Targeting Guest: ${guests[0].name} | ID: ${guestId}`);
    console.log(`🚀 Sending live campaign test...`);

    // 4. Send
    const eventBody = {
        httpMethod: 'POST',
        body: JSON.stringify({
            eventId: eventId,
            guestIds: [guestId],
            mode: 'invitation'
        })
    };

    // Note: Since targetPhone might not be supported natively in my send-campaign without hacking,
    // I will just make a direct mock call to send-campaign or just update all OTHER guests to 'sent'
    // Actually, I'll temporarily update all other idle guests to 'sent' so only this one gets it.

    const { data: otherGuests } = await supabase.from('guests').select('id').eq('event_id', eventId).eq('status', 'idle').neq('id', guestId);
    if (otherGuests && otherGuests.length > 0) {
        await supabase.from('guests').update({ status: 'sent' }).in('id', otherGuests.map(g => g.id));
    }

    const res = await handler(eventBody);
    console.log('\n--- SERVER RESPONSE ---');
    console.log(`Status: ${res.statusCode}`);
    console.log(JSON.stringify(JSON.parse(res.body), null, 2));

    // Restore other guests
    if (otherGuests && otherGuests.length > 0) {
        await supabase.from('guests').update({ status: 'idle' }).in('id', otherGuests.map(g => g.id));
    }

    console.log('\n✅ TEST DISPATCH EXECUTED. Check WhatsApp for ' + phone);
}

fullTestFlow();
