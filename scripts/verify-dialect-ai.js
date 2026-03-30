
import rsvpAI from '../src/services/rsvp-ai-service.js';

async function testDialectAI() {
    console.log('🚀 [Verify-AI] Testing Saudi Dialect RSVP Intelligence...\n');

    const testCases = [
        {
            name: 'Confirmation (Dialect)',
            text: 'ابشر من عيوني بجيك انا واهلي',
            lastSent: 'هل ستشرفنا بحضورك في حفل الزفاف؟'
        },
        {
            name: 'Declined (Nuanced)',
            text: 'والله ودي احضر بس للاسف مرتبط بموعد مع الاهل في نفس اليوم، الجايات اكثر بإذن الله',
            lastSent: 'نتطلع لرؤيتك في حفلنا'
        },
        {
            name: 'Direct Number (1)',
            text: '1',
            lastSent: 'لتأكيد الحضور أرسل رقم 1، للاعتذار أرسل رقم 2'
        },
        {
            name: 'Inquiry',
            text: 'متى يبدأ الحفل بالضبط؟ ووين الموقع؟',
            lastSent: 'نحن بانتظاركم في قاعة المملكة'
        },
        {
            name: 'Companions mentions',
            text: 'تم التأكيد، بكون موجود ومعي 3 اشخاص',
            lastSent: 'يرجى تأكيد الحضور وذكر عدد المرافقين'
        }
    ];

    for (const test of testCases) {
        console.log(`📝 Testing: "${test.name}"`);
        console.log(`   Reply: "${test.text}"`);
        
        try {
            const result = await rsvpAI.analyzeReply(test.text, 'Test Guest', test.lastSent);
            console.log(`   ✅ Result: ${result.status?.toUpperCase() || 'NONE'} (Conf: ${result.confidence})`);
            console.log(`   💡 Reasoning: ${result.reasoning}`);
            if (result.companion_count > 0) console.log(`   👥 Guests: ${result.companion_count}`);
            console.log('----------------------------------');
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
    }
}

testDialectAI().catch(console.error);
