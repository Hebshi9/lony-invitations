import geminiService from '../src/services/gemini-service.ts';

async function testGeminiService() {
    console.log('🧪 Testing Gemini Service...\n');

    // Test 1: Excel Mapping
    console.log('📊 Test 1: Excel Column Mapping');
    const headers = ['اسم الضيف', 'موبايل', 'رقم الطاولة', 'الفئة'];
    try {
        const mapping = await geminiService.mapExcelColumns(headers);
        console.log('✅ Mapping:', mapping);
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n---\n');

    // Test 2: WhatsApp Message Generation
    console.log('💬 Test 2: WhatsApp Message Generation');
    try {
        const message = await geminiService.generateWhatsAppMessage({
            guestName: 'أحمد',
            eventName: 'حفل زفاف',
            eventDate: '20 يناير 2026',
            eventLocation: 'قاعة الفرح',
            category: 'VIP'
        });
        console.log('✅ Message:', message);
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n---\n');

    // Test 3: RSVP Detection
    console.log('✅ Test 3: RSVP Detection');
    const replies = [
        'نعم أكيد حاضرين',
        'للأسف ما نقدر نحضر',
        'ان شاء الله نحاول'
    ];

    for (const reply of replies) {
        try {
            const status = await geminiService.detectRSVP(reply);
            console.log(`"${reply}" → ${status}`);
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    console.log('\n🎉 All tests completed!');
}

testGeminiService();
