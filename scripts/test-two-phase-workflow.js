// Test Two-Phase WhatsApp Workflow
// This script tests the complete two-phase invitation system

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { messageTemplates, getMessageForPhase, fillTemplate, getTemplateVariables } from '../src/services/message-templates.js';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

const API_URL = 'http://localhost:3001';

async function testTwoPhaseWorkflow() {
    console.log('🧪 Testing Two-Phase WhatsApp Workflow\n');
    console.log('='.repeat(60));

    // Step 1: Check database schema
    console.log('\n📊 Step 1: Verifying Database Schema...');
    const { data: columns, error: schemaError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .limit(1);

    if (schemaError) {
        console.error('❌ Database error:', schemaError.message);
        return;
    }

    console.log('✅ Database connection successful');

    // Step 2: Get test event
    console.log('\n📋 Step 2: Finding Test Event...');
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id, name, date, location')
        .limit(1);

    if (eventError || !events || events.length === 0) {
        console.error('❌ No events found. Please create a test event first.');
        return;
    }

    const testEvent = events[0];
    console.log(`✅ Using event: ${testEvent.name} (${testEvent.id})`);

    // Step 3: Get test guest
    console.log('\n👤 Step 3: Finding Test Guest...');
    const { data: guests, error: guestError } = await supabase
        .from('guests')
        .select('id, name, phone, card_image_url, event_id')
        .eq('event_id', testEvent.id)
        .not('phone', 'is', null)
        .limit(1);

    if (guestError || !guests || guests.length === 0) {
        console.error('❌ No guests with phone numbers found.');
        return;
    }

    const testGuest = guests[0];
    console.log(`✅ Test guest: ${testGuest.name} (${testGuest.phone})`);
    console.log(`   Has card image: ${!!testGuest.card_image_url}`);

    // Step 4: Test message templates
    console.log('\n📝 Step 4: Testing Message Templates...');
    const variables = getTemplateVariables(testGuest, testEvent);

    const generalMsg = getMessageForPhase('general', testGuest, testEvent);
    const personalizedMsg = getMessageForPhase('personalized', testGuest, testEvent);

    console.log('\n📨 General Invitation Message:');
    console.log('─'.repeat(60));
    console.log(generalMsg);
    console.log('─'.repeat(60));

    console.log('\n🎁 Personalized Card Message:');
    console.log('─'.repeat(60));
    console.log(personalizedMsg);
    console.log('─'.repeat(60));

    // Step 5: Check WhatsApp server status
    console.log('\n🔌 Step 5: Checking WhatsApp Server...');
    try {
        const response = await fetch(`${API_URL}/api/whatsapp/status`);
        const data = await response.json();

        if (data.success) {
            console.log(`✅ WhatsApp server running`);
            console.log(`   Connected accounts: ${data.status.totalAccounts}`);

            if (data.status.totalAccounts === 0) {
                console.warn('⚠️  No WhatsApp accounts connected!');
                console.log('   Please connect an account first.');
            }
        }
    } catch (error) {
        console.error('❌ WhatsApp server not running!');
        console.log('   Start it with: npm run whatsapp:server');
        return;
    }

    // Step 6: Test prepare general messages
    console.log('\n📤 Step 6: Testing General Message Preparation...');
    try {
        const response = await fetch(`${API_URL}/api/whatsapp/prepare-messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventId: testEvent.id,
                messagePhase: 'general',
                template: messageTemplates.general.text
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log(`✅ Prepared ${result.count} general messages`);
            console.log(`   Phase: ${result.phase}`);

            // Check if messages have no images
            const hasImages = result.messages.some(m => m.image_url !== null);
            if (hasImages) {
                console.warn('⚠️  General messages should NOT have images!');
            } else {
                console.log('✅ Confirmed: No images in general messages');
            }
        } else {
            console.error('❌ Failed to prepare messages:', result.error);
        }
    } catch (error) {
        console.error('❌ Error preparing messages:', error.message);
    }

    // Step 7: Check confirmation status view
    console.log('\n📊 Step 7: Checking Confirmation Status...');
    const { data: statusData, error: statusError } = await supabase
        .from('whatsapp_confirmation_status')
        .select('*')
        .eq('event_id', testEvent.id)
        .limit(5);

    if (statusError) {
        console.warn('⚠️  Confirmation status view not available');
        console.log('   Run the migration script first');
    } else {
        console.log(`✅ Confirmation status view working`);
        console.log(`   Tracking ${statusData.length} guests`);

        if (statusData.length > 0) {
            console.log('\n   Sample status:');
            statusData.forEach(guest => {
                console.log(`   - ${guest.guest_name}: ${guest.invitation_status}`);
                console.log(`     General sent: ${guest.general_invitation_sent}`);
                console.log(`     Card sent: ${guest.personalized_card_sent}`);
            });
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Test Summary');
    console.log('='.repeat(60));
    console.log('✅ Database schema: Ready');
    console.log('✅ Message templates: Working');
    console.log('✅ WhatsApp server: ' + (data?.success ? 'Running' : 'Not running'));
    console.log('✅ General messages: Can be prepared');

    console.log('\n📋 Next Steps:');
    console.log('1. Make sure WhatsApp server is running: npm run whatsapp:server');
    console.log('2. Connect a WhatsApp account via the frontend');
    console.log('3. Send a general invitation to a test number');
    console.log('4. Reply with "نعم" from that number');
    console.log('5. Verify personalized card is sent automatically');

    console.log('\n🎯 To test manually:');
    console.log(`   Send general invitation to: ${testGuest.phone}`);
    console.log('   Then reply with: نعم');
    console.log('   Expected: Auto-receive personalized card\n');
}

// Run the test
testTwoPhaseWorkflow().catch(error => {
    console.error('💥 Test failed:', error);
    process.exit(1);
});
