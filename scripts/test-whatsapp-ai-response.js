import rsvpAI from '../src/services/rsvp-ai-service.js';
import dotenv from 'dotenv';
dotenv.config();

async function testAI() {
    console.log('🧪 Testing WhatsApp AI Response Analysis...\n');

    const testCases = [
        { text: "ان شاء الله حاضرين", guest: "أحمد" },
        { text: "شكراً على الدعوة، لكن للأسف ما نقدر نحضر", guest: "سارة" },
        { text: "ممكن، بشوف الظروف وارد لكم", guest: "خالد" },
        { text: "حاضرين أنا وزوجتي والأولاد", guest: "محمد" },
        { text: "مبروك، الله يتمم لكم على خير", guest: "نورة" }, // Congratulation, not necessarily RSVP yet but general
        { text: "متى الموعد بالظبط؟", guest: "فهد" } // Question
    ];

    for (const test of testCases) {
        console.log(`\n📨 Input: "${test.text}" (Guest: ${test.guest})`);

        try {
            const result = await rsvpAI.analyzeReply(test.text, test.guest);
            console.log('🤖 AI Analysis:');
            console.log(JSON.stringify(result, null, 2));

            // Basic validation log
            if (result.confidence > 0.7) {
                console.log(`✅ Classified as: ${result.status} (Confidence: ${result.confidence})`);
            } else {
                console.log(`⚠️ Low confidence or Not RSVP`);
            }

        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }
}

testAI();
