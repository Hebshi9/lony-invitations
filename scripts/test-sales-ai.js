import lonySalesAI from '../src/services/lony-sales-ai.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSalesAI() {
    console.log('🤖 Testing Lony Sales AI Agent\n');
    console.log('='.repeat(70));

    const testMessages = [
        'يا هلا، وش الخدمات اللي تقدمونها؟',
        'أبي أحجز دعوة إلكترونية لزواجي',
        'كم سعر الباقة الكاملة؟',
        'عندكم خصم؟',
        'ممكن أكلم المدير؟',
        'وش الفرق بينكم وبين المنافسين؟'
    ];

    for (const message of testMessages) {
        console.log(`\n📨 العميل: "${message}"`);
        console.log('-'.repeat(70));

        try {
            const result = await lonySalesAI.generateResponse(message);

            console.log(`🤖 لوني: ${result.response}`);
            console.log(`\n📊 التحليل:`);
            console.log(`   Intent: ${result.intent || 'N/A'}`);
            console.log(`   Priority: ${result.priority || 'N/A'}`);
            if (result.notes) {
                console.log(`   Notes: ${result.notes}`);
            }

        } catch (error) {
            console.error('❌ Error:', error.message);
        }

        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test Complete!\n');
}

testSalesAI();
