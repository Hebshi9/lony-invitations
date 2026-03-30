import rsvpAI from '../src/services/rsvp-ai-service.js';
import dotenv from 'dotenv';
dotenv.config();

async function testRSVPLogic() {
    try {
        console.log('🧪 Testing RSVP AI Logic Directly...');
        
        const testCases = [
            { text: 'ابشر', name: 'محمد' },
            { text: 'تم', name: 'أحمد' },
            { text: 'معتذر', name: 'خالد' },
            { text: 'ان شاء الله بحضر', name: 'سلطان' }
        ];

        for (const test of testCases) {
            console.log(`\n📝 Testing: "${test.text}" for ${test.name}`);
            const result = await rsvpAI.analyzeReply(test.text, test.name, 'نتشرف بدعوتك');
            console.log('✅ Result Status:', result.status);
            console.log('✅ Is RSVP:', result.is_rsvp);
            console.log('✅ Confidence:', result.confidence);
        }
    } catch (e) {
        console.error('💥 GLOBAL ERROR:', e);
    }
}

testRSVPLogic();
