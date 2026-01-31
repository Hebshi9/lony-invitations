import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testSend() {
    console.log('🧪 Testing WhatsApp Send...\n');

    // Test API connection
    try {
        const response = await fetch('http://localhost:3001/api/whatsapp/status');
        const data = await response.json();
        console.log('✅ Server is running');
        console.log('Connected accounts:', data.status.totalAccounts);
        console.log('Account IDs:', data.status.connectedAccounts);
    } catch (error) {
        console.error('❌ Server not reachable:', error.message);
        return;
    }

    // Get a test guest
    const { data: guest } = await supabase
        .from('guests')
        .select('id, name, phone, card_image_url')
        .eq('name', 'احمد الحبشي')
        .single();

    if (!guest) {
        console.error('❌ Test guest not found');
        return;
    }

    console.log('\n📋 Test Guest:');
    console.log('Name:', guest.name);
    console.log('Phone:', guest.phone);
    console.log('Has Image:', !!guest.card_image_url);
    console.log('Image URL:', guest.card_image_url || 'N/A');

    // Try to send
    console.log('\n📤 Attempting to send...');
    try {
        const response = await fetch('http://localhost:3001/api/whatsapp/send-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId: guest.event_id || 'test'
            })
        });

        const result = await response.json();
        console.log('\n📊 Result:', result);
    } catch (error) {
        console.error('\n❌ Send failed:', error.message);
    }
}

testSend();
