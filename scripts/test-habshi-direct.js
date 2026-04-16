
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function verifyHabshi() {
    console.log('🔍 Searching for Habshi Event...');
    const { data: event, error: eError } = await supabase
        .from('events')
        .select('*')
        .ilike('name', '%الحبشي%')
        .single();

    if (eError || !event) {
        console.error('❌ Event not found:', eError?.message || 'Empty result');
        return;
    }

    console.log('✅ Found Event:', event.name, 'ID:', event.id);

    // Get 1 test guest
    const { data: guests, error: gError } = await supabase
        .from('guests')
        .select('id, name, phone')
        .eq('event_id', event.id)
        .limit(1);

    if (gError || !guests || guests.length === 0) {
        console.error('❌ No guests found for this event');
        return;
    }

    const testGuest = guests[0];
    console.log('👤 Testing with Guest:', testGuest.name, 'ID:', testGuest.id);

    // Trigger the Netlify Background Function directly
    // Note: We call it with the full Netlify URL since we are running locally
    const netlifyUrl = 'https://lonyinvite.netlify.app/.netlify/functions/send-campaign-background';
    
    console.log('🚀 Triggering Cloud Engine...');
    try {
        const response = await fetch(netlifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                guestIds: [testGuest.id],
                eventId: event.id,
                campaignType: 'invite'
            })
        });

        if (response.status === 202) {
            console.log('🎯 Cloud Engine Accepted the task (202 Accepted)');
            console.log('📊 Check the "whatsapp_messages" table in 10-20 seconds for the result.');
        } else {
            console.log('⚠️ Unexpected response:', response.status);
            const text = await response.text();
            console.log('Response body:', text);
        }
    } catch (err) {
        console.error('❌ Network error calling Cloud Engine:', err.message);
    }
}

verifyHabshi();
