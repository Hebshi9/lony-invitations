import lonySalesAI from '../src/services/lony-sales-ai.js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function demo() {
    console.log('\n🎯 تجربة الـ Sales AI Agent (OpenAI)');
    console.log('='.repeat(70) + '\n');

    const message = 'يا هلا، وش الخدمات اللي تقدمونها؟';

    console.log(`📱 العميل يقول: "${message}"\n`);
    console.log('⏳ جاري الرد...\n');

    const result = await lonySalesAI.generateResponse(message);

    console.log('🤖 لوني يرد:');
    console.log('━'.repeat(70));
    console.log(result.response);
    console.log('━'.repeat(70));

    console.log('\n📊 تحليل الـ AI:');
    console.log(`   • نوع الاستفسار: ${result.intent}`);
    console.log(`   • الأولوية: ${result.priority || 'متوسطة'}`);
    if (result.notes) {
        console.log(`   • ملاحظات: ${result.notes}`);
    }

    console.log('\n✅ التجربة تمت بنجاح!\n');

    // حفظ النتيجة
    fs.writeFileSync('sales-ai-demo.json', JSON.stringify(result, null, 2), 'utf8');
    console.log('💾 تم حفظ النتيجة في: sales-ai-demo.json\n');
}

demo().catch(err => {
    console.error('\n❌ خطأ:', err.message);
    console.error(err);
});
