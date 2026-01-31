import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function setupTestData() {
    console.log('🚀 Setting up test data for WhatsApp...\n');

    // 1. Create a test event
    console.log('1️⃣ Creating test event...');
    const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([{
            name: 'حفل اختبار WhatsApp',
            date: '2026-02-15',
            location: 'قاعة الاختبار',
            description: 'حدث تجريبي لاختبار WhatsApp'
        }])
        .select()
        .single();

    if (eventError) {
        console.error('❌ Error creating event:', eventError.message);
        return;
    }
    console.log('✅ Event created:', event.name, `(ID: ${event.id})`);

    // 2. Create test guests with phone numbers
    console.log('\n2️⃣ Creating test guests...');
    const testGuests = [
        { name: 'أحمد محمد', phone: '+966500000001' },
        { name: 'فاطمة علي', phone: '+966500000002' },
        { name: 'خالد سعيد', phone: '+966500000003' }
    ];

    for (const guest of testGuests) {
        const { data, error } = await supabase
            .from('guests')
            .insert([{
                event_id: event.id,
                name: guest.name,
                phone: guest.phone,
                qr_token: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }])
            .select()
            .single();

        if (error) {
            console.error(`❌ Error creating guest ${guest.name}:`, error.message);
        } else {
            console.log(`✅ Guest created: ${guest.name} (${guest.phone})`);
        }
    }

    console.log('\n✅ Test data setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to http://localhost:5173/whatsapp-sender');
    console.log(`2. Select event: "${event.name}"`);
    console.log('3. Connect a WhatsApp account');
    console.log('4. Click "تجهيز الرسائل" (Prepare Messages)');
    console.log('5. Click "بدء الإرسال" (Start Sending)');
    console.log('\n⚠️ Note: Use test phone numbers or your own number for testing!');
}

setupTestData();
